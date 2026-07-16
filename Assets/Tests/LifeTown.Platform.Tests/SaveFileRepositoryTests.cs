using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using LifeTown.Economy.Core.Models;
using LifeTown.Platform.Persistence;

namespace LifeTown.Platform.Tests
{
    /// <summary>
    /// Round-trip and crash-safety coverage for <see cref="SaveFileRepository"/> (spec §9,
    /// §11.2 week 3-4). Runs against a real temp directory on the local filesystem - this
    /// is genuine on-device-shaped file IO, not a mock, just pointed at a scratch path
    /// instead of <see cref="LifeTown.Platform.Persistence.SavePaths.DefaultSaveFilePath"/>.
    /// </summary>
    public class SaveFileRepositoryTests
    {
        private string _dir;
        private string _path;
        private SaveFileRepository _repo;

        [SetUp]
        public void SetUp()
        {
            _dir = Path.Combine(Path.GetTempPath(), "LifeTownPlatformTests_" + System.Guid.NewGuid());
            Directory.CreateDirectory(_dir);
            _path = Path.Combine(_dir, "savefile.json");
            _repo = new SaveFileRepository(_path);
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
        }

        [Test]
        public void Load_NoFileYet_ReturnsNull()
        {
            Assert.IsNull(_repo.Load(), "first launch on a fresh device has no save file - the repository must say so plainly, not throw or fabricate one");
        }

        [Test]
        public void SaveThenLoad_RoundTripsLossless()
        {
            var original = BuildSample();

            _repo.Save(original);
            var loaded = _repo.Load();

            Assert.IsNotNull(loaded);
            Assert.AreEqual(original.schemaVersion, loaded.schemaVersion);
            Assert.AreEqual(original.profile.playerId, loaded.profile.playerId);
            Assert.AreEqual(original.profile.daysRecordedCount, loaded.profile.daysRecordedCount);
            Assert.AreEqual(original.wallet.coin, loaded.wallet.coin);
            Assert.AreEqual(original.wallet.totalExpEarned, loaded.wallet.totalExpEarned);

            Assert.AreEqual(original.town.buildings.Count, loaded.town.buildings.Count);
            Assert.AreEqual(original.town.buildings[0].buildingId, loaded.town.buildings[0].buildingId);
            Assert.AreEqual(original.town.buildings[0].gridX, loaded.town.buildings[0].gridX);
            CollectionAssert.AreEqual(original.town.occupiedCells, loaded.town.occupiedCells);

            Assert.AreEqual(original.sessions.Count, loaded.sessions.Count);
            Assert.AreEqual(original.sessions[0].sessionId, loaded.sessions[0].sessionId);
            CollectionAssert.AreEqual(original.sessions[0].adjustments, loaded.sessions[0].adjustments);

            // The Dictionary field is exactly what JsonUtility cannot serialize - this is
            // the field that requires Newtonsoft (spec §7.5).
            Assert.AreEqual(original.dailyStats[0].perCategoryCreditedSeconds["reading"],
                loaded.dailyStats[0].perCategoryCreditedSeconds["reading"]);
            Assert.AreEqual(original.dailyStats[0].sessionIntervals.Count, loaded.dailyStats[0].sessionIntervals.Count);
            CollectionAssert.AreEqual(original.dailyStats[0].sessionIntervals[0], loaded.dailyStats[0].sessionIntervals[0]);

            Assert.IsNotNull(loaded.running);
            Assert.AreEqual(original.running.sessionId, loaded.running.sessionId);
            Assert.AreEqual(original.running.bootTimeMs, loaded.running.bootTimeMs);
        }

        [Test]
        public void Save_IsIdempotent_SavingTwiceThenLoadingReturnsLatest()
        {
            _repo.Save(BuildSample("v1"));
            _repo.Save(BuildSample("v2"));

            var loaded = _repo.Load();
            Assert.AreEqual("v2", loaded.profile.lastRecordedDateKey);
        }

        [Test]
        public void SimulatedCrashMidWrite_LeavesPreviousSaveIntactAndLoadable()
        {
            _repo.Save(BuildSample("v1"));

            // Simulate the process dying mid-write: a stray temp file appears next to the
            // real save (as WriteAtomic's first step would leave, had it been interrupted
            // before the atomic replace), but the repository's Save() was never called
            // again to complete it.
            AtomicFileWriter.WriteTemp(_path, "{ half written json that never got committed ...");

            var loaded = _repo.Load();

            Assert.IsNotNull(loaded);
            Assert.AreEqual("v1", loaded.profile.lastRecordedDateKey, "Load() must never be fooled by a stray temp file - only a committed save is real");
        }

        [Test]
        public void SaveNull_Throws()
        {
            Assert.Throws<System.ArgumentNullException>(() => _repo.Save(null));
        }

        [Test]
        public void EmptyPath_Throws()
        {
            Assert.Throws<System.ArgumentException>(() => new SaveFileRepository(""));
            Assert.Throws<System.ArgumentException>(() => new SaveFileRepository(null));
        }

        private static SaveFile BuildSample(string tag = "v1")
        {
            return new SaveFile
            {
                schemaVersion = 1,
                profile = new PlayerProfile
                {
                    playerId = "player-abc",
                    firstOpenedAtMs = 1_700_000_000_000L,
                    daysRecordedCount = 7,
                    lastRecordedDateKey = tag,
                    onboardingComplete = true,
                    notificationsEnabled = true,
                    notificationHour = 20,
                    notificationMinute = 0,
                },
                wallet = new Wallet { coin = 12345, totalExpEarned = 6789 },
                town = new TownState
                {
                    gridWidth = 8,
                    gridHeight = 8,
                    buildings = new List<BuildingInstance>
                    {
                        new BuildingInstance
                        {
                            buildingId = "b1", categoryId = "reading", tier = 1, level = 3,
                            accumulatedExp = 240, gridX = 2, gridY = 5, createdAtMs = 1_700_000_100_000L,
                        }
                    },
                    occupiedCells = BuildOccupiedCells(),
                    version = 1,
                },
                sessions = new List<SessionRecord>
                {
                    new SessionRecord
                    {
                        sessionId = "s1", categoryId = "reading",
                        startWallMs = 1_700_000_000_000L, endWallMs = 1_700_001_500_000L,
                        bootTimeMs = 1_699_000_000_000L, monotonicElapsedMs = 1_500_000,
                        lastConfirmedAtMs = 1_500_000, rawSeconds = 1500, creditedSeconds = 1500,
                        expAwarded = 1500, coinAwarded = 1500, appliedToBuildingId = "b1",
                        adjustments = new[] { "presence_timeout" }, presenceConfirmCount = 1,
                        wasRecovered = false,
                    }
                },
                dailyStats = new List<DailyStat>
                {
                    new DailyStat
                    {
                        dateKey = "2026-07-16",
                        totalCreditedSeconds = 1500,
                        perCategoryCreditedSeconds = new Dictionary<string, int> { { "reading", 1500 } },
                        growthSeconds = 1500, leisureSeconds = 0, rawSecondsBeforeCaps = 1500,
                        sessionIntervals = new List<long[]> { new[] { 1_700_000_000_000L, 1_700_001_500_000L } },
                    }
                },
                running = new RunningSession
                {
                    sessionId = "s2", categoryId = "study",
                    startMonotonicMs = 100, startWallMs = 1_700_002_000_000L,
                    bootTimeMs = 1_699_000_000_000L, lastConfirmedAtMs = 0, lastPingSentAtMs = 0,
                    presenceConfirmCount = 0,
                },
            };
        }

        private static string[] BuildOccupiedCells()
        {
            var cells = new string[64];
            cells[42] = "b1";
            return cells;
        }
    }
}
