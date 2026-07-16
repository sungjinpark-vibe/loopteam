using System.IO;
using NUnit.Framework;
using LifeTown.Platform.Persistence;

namespace LifeTown.Platform.Tests
{
    /// <summary>
    /// Exercises the crash-safety property directly: a process kill between
    /// <see cref="AtomicFileWriter.WriteTemp"/> and <see cref="AtomicFileWriter.CommitReplace"/>
    /// must never surface as a change to the target file (spec §9, §11.2 week 3-4).
    /// </summary>
    public class AtomicFileWriterTests
    {
        private string _dir;
        private string _path;

        [SetUp]
        public void SetUp()
        {
            _dir = Path.Combine(Path.GetTempPath(), "LifeTownPlatformTests_" + System.Guid.NewGuid());
            Directory.CreateDirectory(_dir);
            _path = Path.Combine(_dir, "save.json");
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
        }

        [Test]
        public void WriteAtomic_FirstEverWrite_CreatesFileWithContent()
        {
            AtomicFileWriter.WriteAtomic(_path, "\"v1\"");
            Assert.IsTrue(File.Exists(_path));
            Assert.AreEqual("\"v1\"", File.ReadAllText(_path));
        }

        [Test]
        public void WriteTemp_NeverTouchesTargetUntilCommit()
        {
            AtomicFileWriter.WriteAtomic(_path, "\"v1\"");

            string tempPath = AtomicFileWriter.WriteTemp(_path, "\"v2\"");

            Assert.AreEqual("\"v1\"", File.ReadAllText(_path), "the target must be untouched until CommitReplace runs");
            Assert.IsTrue(File.Exists(tempPath));
            Assert.AreEqual("\"v2\"", File.ReadAllText(tempPath));
        }

        [Test]
        public void CommitReplace_MakesTempTheNewTarget_AndConsumesTheTemp()
        {
            AtomicFileWriter.WriteAtomic(_path, "\"v1\"");
            string tempPath = AtomicFileWriter.WriteTemp(_path, "\"v2\"");

            AtomicFileWriter.CommitReplace(_path, tempPath);

            Assert.AreEqual("\"v2\"", File.ReadAllText(_path));
            Assert.IsFalse(File.Exists(tempPath), "the temp file must be consumed by the replace, not left behind");
        }

        [Test]
        public void SimulatedCrash_TempWrittenButNeverCommitted_TargetUnaffected()
        {
            // Establish "the previous good save".
            AtomicFileWriter.WriteAtomic(_path, "\"good-save\"");

            // Simulate a process kill that happens exactly between WriteTemp and
            // CommitReplace: a stray, possibly-garbage temp file sits on disk, but
            // CommitReplace never ran. This is precisely what a real crash mid-write
            // leaves behind on the filesystem.
            AtomicFileWriter.WriteTemp(_path, "{ this is a half-written / corrupt payload, never committed");

            Assert.AreEqual("\"good-save\"", File.ReadAllText(_path),
                "a stray temp file alone must never surface as the current save - the previous good save must survive untouched");
        }

        [Test]
        public void AfterSimulatedCrash_ANewSuccessfulWriteRecoversNormally()
        {
            AtomicFileWriter.WriteAtomic(_path, "\"good-save\"");
            AtomicFileWriter.WriteTemp(_path, "corrupt, never committed"); // stray leftover from a "crash"

            // The app relaunches and successfully saves again - the stray temp file must
            // not block or corrupt the next legitimate write.
            AtomicFileWriter.WriteAtomic(_path, "\"new-good-save\"");

            Assert.AreEqual("\"new-good-save\"", File.ReadAllText(_path));
        }
    }
}
