using System;
using System.Collections.Generic;
using LifeTown.App.BuildingKit;
using LifeTown.Economy.Core;
using LifeTown.Economy.Core.Models;
using LifeTown.Platform.Persistence;

namespace LifeTown.App.Game
{
    /// <summary>
    /// Owns the one <see cref="SaveFile"/> and every write to it (spec §9). This is the
    /// "wiring layer" the task asks for: it is the only place that calls
    /// <see cref="Settlement"/> and <see cref="LevelCurve"/> from app code, and the only
    /// place that talks to <see cref="SaveFileRepository"/> (LifeTown.Platform, T003).
    /// Deliberately plain C# (no MonoBehaviour, no UnityEngine reference) so it is
    /// EditMode-testable with a temp-file repository and a <see cref="FakeClock"/> — the
    /// same seam-injection pattern <see cref="Settlement"/> itself already uses.
    ///
    /// No cap/clamp/curve/settlement math lives here (00-mvp-spec.md §7.4's boundary) —
    /// every number comes back from <see cref="Settlement"/>/<see cref="LevelCurve"/>,
    /// this class only applies the result to the projections (<see cref="Wallet"/>,
    /// <see cref="BuildingInstance"/>, <see cref="DailyStat"/>) and persists them.
    ///
    /// Scope note: this MVP slice pre-populates exactly one Tier1 <see cref="BuildingInstance"/>
    /// per category (the 7 cottages <see cref="LifeTown.App.Village.VillageLayoutBuilder"/>
    /// already places) and never builds/places/merges more — buying additional buildings
    /// (§4.2's BuildCost/ConstructionDuration/MergeRule) is out of scope for this task and
    /// left for the dedicated build/place task. <c>categoryId</c> doubles as
    /// <c>buildingId</c> here for exactly that reason (one building per category); a
    /// future multi-building-per-category feature needs real per-build GUIDs instead.
    /// </summary>
    public sealed class SaveGameService
    {
        readonly SaveFileRepository _repo;
        readonly IMonotonicClock _clock;

        public SaveFile Save { get; private set; }

        public SaveGameService(SaveFileRepository repo, IMonotonicClock clock)
        {
            _repo = repo ?? throw new ArgumentNullException(nameof(repo));
            _clock = clock ?? throw new ArgumentNullException(nameof(clock));

            Save = _repo.Load() ?? CreateDefault(_clock.WallMs);
            RecoverInterruptedSession();
            Persist();
        }

        /// <summary>Starts a new live session for <paramref name="categoryId"/> and persists
        /// the <see cref="RunningSession"/> immediately (I2 crash recovery, §5.3) — so an
        /// app kill mid-session is recoverable on the next launch via
        /// <see cref="RecoverInterruptedSession"/>, not lost.</summary>
        public RunningSession StartSession(string categoryId)
        {
            if (Save.running != null)
                throw new InvalidOperationException("A session is already running.");

            var running = new RunningSession
            {
                sessionId = Guid.NewGuid().ToString(),
                categoryId = categoryId,
                startMonotonicMs = _clock.ElapsedMs,
                startWallMs = _clock.WallMs,
                bootTimeMs = _clock.WallMs - _clock.ElapsedMs, // I6 (§7.3.2)
                lastConfirmedAtMs = 0,
                lastPingSentAtMs = 0,
                presenceConfirmCount = 0,
            };
            Save.running = running;
            Persist();
            return running;
        }

        /// <summary>Ends the running session live (app never left memory) and settles it via
        /// <see cref="Settlement.CommitLive"/>. <paramref name="debugOffsetMs"/> lets a
        /// debug-skip button simulate extra elapsed time without lying to the real
        /// monotonic clock (I1 stays intact — the clock is never touched, only the elapsed
        /// value handed to Settlement is). Returns null if no session was running.</summary>
        public SessionRecord FinishSession(long debugOffsetMs = 0)
        {
            var running = Save.running;
            if (running == null) return null;

            long endElapsedMs = _clock.ElapsedMs + Math.Max(0, debugOffsetMs);
            var usage = ComputeUsageSoFar(running.categoryId, _clock.WallMs);
            string buildingId = FindBuildingId(running.categoryId);

            var record = Settlement.CommitLive(
                running.sessionId, running.categoryId, buildingId,
                running.startWallMs, _clock.WallMs,
                running.startMonotonicMs, endElapsedMs,
                running.lastConfirmedAtMs, usage,
                EconomyConfig.Default, running.presenceConfirmCount);

            Save.running = null;
            ApplyRecord(record);
            Persist();
            return record;
        }

        void RecoverInterruptedSession()
        {
            var running = Save.running;
            if (running == null) return;

            var usage = ComputeUsageSoFar(running.categoryId, _clock.WallMs);
            string buildingId = FindBuildingId(running.categoryId);

            var record = Settlement.CommitRecovered(
                running.sessionId, running.categoryId, buildingId,
                running.startWallMs, _clock.WallMs,
                running.startMonotonicMs, _clock.ElapsedMs,
                running.bootTimeMs, running.lastConfirmedAtMs, usage,
                EconomyConfig.Default, running.presenceConfirmCount);

            Save.running = null;
            ApplyRecord(record);
        }

        void ApplyRecord(SessionRecord record)
        {
            Save.sessions.Add(record);
            Save.wallet.coin += record.coinAwarded;
            Save.wallet.totalExpEarned += record.expAwarded;

            if (record.appliedToBuildingId != null)
            {
                var building = Save.town.buildings.Find(b => b.buildingId == record.appliedToBuildingId);
                if (building != null) LevelCurve.ApplyExp(building, record.expAwarded);
            }

            ApplyDailyStat(record);
        }

        void ApplyDailyStat(SessionRecord record)
        {
            string key = DateKeyFor(record.endWallMs);
            var stat = Save.dailyStats.Find(s => s.dateKey == key);
            if (stat == null)
            {
                stat = new DailyStat { dateKey = key };
                Save.dailyStats.Add(stat);
            }

            stat.totalCreditedSeconds += record.creditedSeconds;
            stat.rawSecondsBeforeCaps += record.rawSeconds;
            stat.perCategoryCreditedSeconds.TryGetValue(record.categoryId, out int prior);
            stat.perCategoryCreditedSeconds[record.categoryId] = prior + record.creditedSeconds;

            var def = CategoryCatalog.ById(record.categoryId);
            bool isGrowth = def == null || def.type == CategoryType.Growth; // D9: growth/leisure only labels the report, never the payout
            if (isGrowth) stat.growthSeconds += record.creditedSeconds;
            else stat.leisureSeconds += record.creditedSeconds;

            stat.sessionIntervals.Add(new[] { record.startWallMs, record.endWallMs });

            if (record.creditedSeconds > 0 && Save.profile.lastRecordedDateKey != key)
            {
                Save.profile.daysRecordedCount++; // D4: cumulative, never resets
                Save.profile.lastRecordedDateKey = key;
            }
        }

        DailyCaps.UsageSoFar ComputeUsageSoFar(string categoryId, long wallMs)
        {
            var stat = Save.dailyStats.Find(s => s.dateKey == DateKeyFor(wallMs));
            if (stat == null) return DailyCaps.UsageSoFar.Empty;

            stat.perCategoryCreditedSeconds.TryGetValue(categoryId, out int categorySeconds);
            return new DailyCaps.UsageSoFar(categorySeconds, stat.totalCreditedSeconds);
        }

        string FindBuildingId(string categoryId) => Save.town.buildings.Find(b => b.categoryId == categoryId)?.buildingId;

        static string DateKeyFor(long wallMs) => DateTimeOffset.FromUnixTimeMilliseconds(wallMs).ToLocalTime().ToString("yyyy-MM-dd");

        void Persist() => _repo.Save(Save);

        static SaveFile CreateDefault(long nowWallMs)
        {
            var save = new SaveFile
            {
                schemaVersion = 1,
                profile = new PlayerProfile { playerId = Guid.NewGuid().ToString(), firstOpenedAtMs = nowWallMs, onboardingComplete = true },
                wallet = new Wallet(),
                town = new TownState(),
                sessions = new List<SessionRecord>(),
                dailyStats = new List<DailyStat>(),
                running = null,
            };

            int i = 0;
            foreach (var def in CategoryCatalog.All)
            {
                save.town.buildings.Add(new BuildingInstance
                {
                    buildingId = def.id,
                    categoryId = def.id,
                    tier = 1,
                    level = 1,
                    accumulatedExp = 0,
                    gridX = i,
                    gridY = 0,
                    createdAtMs = nowWallMs,
                    constructionStartedAtMs = nowWallMs,
                    constructionEndsAtMs = 0, // already complete — this slice pre-places all 7, no timed construction (out of scope, see class doc)
                });
                save.town.occupiedCells[i] = def.id;
                i++;
            }
            return save;
        }
    }
}
