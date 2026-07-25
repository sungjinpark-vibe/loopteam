using System;
using System.IO;
using NUnit.Framework;
using LifeTown.App.Game;
using LifeTown.Economy.Core;
using LifeTown.Platform.Persistence;

namespace LifeTown.App.Tests
{
    /// <summary>
    /// T010's wiring layer: proves <see cref="SaveGameService"/> actually calls
    /// LifeTown.Economy.Core.Settlement/LevelCurve (not reimplementing the math itself,
    /// per 00-mvp-spec.md §7.4) and actually persists through LifeTown.Platform's
    /// SaveFileRepository (not an in-memory stand-in) — the two "known trap" foundations
    /// this task exists to wire together. Uses <see cref="FakeClock"/> exactly like
    /// LifeTown.Economy.Core.Tests does, against a real temp-file repository exactly like
    /// LifeTown.Platform.Tests does.
    /// </summary>
    public class SaveGameServiceTests
    {
        string _dir;
        string _path;

        [SetUp]
        public void SetUp()
        {
            _dir = Path.Combine(Path.GetTempPath(), "LifeTownAppTests_" + Guid.NewGuid());
            Directory.CreateDirectory(_dir);
            _path = Path.Combine(_dir, "savefile.json");
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
        }

        SaveGameService NewService(FakeClock clock) => new SaveGameService(new SaveFileRepository(_path), clock);

        [Test]
        public void FreshSave_BootstrapsSevenBuildings_OnePerCategory()
        {
            var save = NewService(new FakeClock());

            Assert.AreEqual(7, save.Save.town.buildings.Count);
            foreach (var def in BuildingKit.CategoryCatalog.All)
            {
                var building = save.Save.town.buildings.Find(b => b.categoryId == def.id);
                Assert.IsNotNull(building, $"no bootstrapped building for category '{def.id}'");
                Assert.AreEqual(1, building.tier);
                Assert.AreEqual(1, building.level);
                Assert.AreEqual(0, building.accumulatedExp);
            }
        }

        [Test]
        public void Session_25Minutes_AwardsExpAndCoin_MatchesEconomyConfig()
        {
            var clock = new FakeClock();
            var save = NewService(clock);

            save.StartSession("reading");
            clock.Advance(25 * 60_000L); // 25 min, well under the 70-min presence-timeout threshold
            var record = save.FinishSession();

            // EconomyConfig.Default: 1 EXP + 1 coin per credited second — not a value this
            // test hardcodes independently of Economy.Core, but read back and cross-checked.
            var cfg = EconomyConfig.Default;
            Assert.AreEqual(1500, record.creditedSeconds);
            Assert.AreEqual(1500 * cfg.ExpPerSecond, record.expAwarded);
            Assert.AreEqual(1500 * cfg.CoinPerSecond, record.coinAwarded);
            Assert.AreEqual(record.coinAwarded, save.Save.wallet.coin);
            Assert.AreEqual(record.expAwarded, save.Save.wallet.totalExpEarned);
            Assert.IsEmpty(record.adjustments, "an honest 25-minute session must show zero deduction rows (spec §5.6)");
        }

        [Test]
        public void Session_ExpAppliesToTargetBuilding_LevelUpsViaLevelCurve()
        {
            var clock = new FakeClock();
            var save = NewService(clock);

            save.StartSession("reading");
            clock.Advance(25 * 60_000L);
            var record = save.FinishSession();

            var building = save.Save.town.buildings.Find(b => b.categoryId == "reading");
            Assert.AreEqual(record.expAwarded, building.accumulatedExp);
            Assert.AreEqual(LevelCurve.LevelForExp(1, record.expAwarded), building.level);
            Assert.AreEqual(4, building.level, "D5 curve [0,60,240,720,2000]: one 25-min/1500-EXP session lands Lv4, not maxed (00-mvp-spec.md §4.1)");
        }

        [Test]
        public void SessionBelowMinimum_RejectedWithNoPayout()
        {
            var clock = new FakeClock();
            var save = NewService(clock);

            save.StartSession("work");
            clock.Advance(10_000L); // 10s < 60s min session (I4)
            var record = save.FinishSession();

            Assert.AreEqual(0, record.creditedSeconds);
            Assert.AreEqual(0, record.expAwarded);
            Assert.AreEqual(0, save.Save.wallet.coin);
            Assert.Contains(AdjustmentReason.MinSessionRejected, record.adjustments);

            var building = save.Save.town.buildings.Find(b => b.categoryId == "work");
            Assert.AreEqual(1, building.level, "a rejected session must not touch the building");
        }

        [Test]
        public void State_PersistsAcrossRestart_ViaPlatformSaveFileRepository()
        {
            var clock1 = new FakeClock();
            var first = NewService(clock1);
            first.StartSession("study");
            clock1.Advance(25 * 60_000L);
            var record = first.FinishSession();

            // Simulate an app restart: a brand new SaveGameService (and clock) pointed at
            // the same on-disk file — nothing is shared in memory with `first`.
            var restarted = NewService(new FakeClock());

            Assert.AreEqual(record.coinAwarded, restarted.Save.wallet.coin);
            Assert.AreEqual(record.expAwarded, restarted.Save.wallet.totalExpEarned);
            var building = restarted.Save.town.buildings.Find(b => b.categoryId == "study");
            Assert.AreEqual(4, building.level);
            Assert.AreEqual(1, restarted.Save.sessions.Count);
        }

        [Test]
        public void InterruptedSession_RecoveredOnNextLaunch_ViaCommitRecovered()
        {
            var clock1 = new FakeClock();
            var crashed = NewService(clock1);
            crashed.StartSession("game");
            clock1.Advance(25 * 60_000L);
            // No FinishSession() call — simulates the process dying mid-session. The
            // RunningSession was already persisted by StartSession (I2 crash recovery).

            var clock2 = new FakeClock { ElapsedMs = clock1.ElapsedMs, WallMs = clock1.WallMs }; // same clock reading a relaunch would observe
            var recovered = NewService(clock2);

            Assert.IsNull(recovered.Save.running, "recovery must clear the running session, not leave it dangling forever");
            Assert.AreEqual(1, recovered.Save.sessions.Count);
            Assert.IsTrue(recovered.Save.sessions[0].wasRecovered);
            Assert.AreEqual(1500, recovered.Save.sessions[0].creditedSeconds);
            Assert.Greater(recovered.Save.wallet.coin, 0);
        }

        [Test]
        public void DebugSkip_SimulatesElapsedTime_WithoutTouchingTheRealClock()
        {
            var clock = new FakeClock();
            var save = NewService(clock);

            save.StartSession("mind");
            // No clock.Advance() at all — the debug-skip offset alone must produce the payout.
            var record = save.FinishSession(debugOffsetMs: 25 * 60_000L);

            Assert.AreEqual(1500, record.creditedSeconds);
            Assert.AreEqual(0, clock.ElapsedMs, "debug-skip must not mutate the monotonic clock (I1) — only the value handed to Settlement");
        }
    }
}
