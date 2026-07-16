using System.IO;
using System.Text;

namespace LifeTown.Platform.Persistence
{
    /// <summary>
    /// Crash-safe file write: write-to-temp, then an OS-level atomic replace (spec §9,
    /// §11.2 week 3-4). A process kill at any point before <see cref="CommitReplace"/>
    /// leaves the original file byte-for-byte untouched - the "last good save" can never
    /// be surfaced as half-written or corrupt.
    ///
    /// Split into two public steps (rather than one Save() call) specifically so EditMode
    /// tests can simulate "the process died between the two steps" - a bare stray temp
    /// file on disk - without needing to actually kill a process. <see cref="WriteAtomic"/>
    /// is the normal-path convenience that runs both.
    /// </summary>
    public static class AtomicFileWriter
    {
        /// <summary>Never touches <paramref name="targetPath"/>. Sibling temp file only.</summary>
        public static string TempPathFor(string targetPath) => targetPath + ".tmp";

        /// <summary>
        /// Step 1: write the full content to a sibling temp file. Creates the destination
        /// directory if it does not exist yet (first-ever save on a fresh device).
        /// </summary>
        public static string WriteTemp(string targetPath, string content)
        {
            string tempPath = TempPathFor(targetPath);
            string dir = Path.GetDirectoryName(targetPath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

            // No BOM: keeps the file plain UTF-8 JSON, matching how it will be re-read.
            File.WriteAllText(tempPath, content, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            return tempPath;
        }

        /// <summary>
        /// Step 2: atomically make the temp file the real file. <see cref="File.Replace"/>
        /// is an atomic rename at the filesystem level - there is no window in which
        /// <paramref name="targetPath"/> is observed as partially written.
        /// </summary>
        public static void CommitReplace(string targetPath, string tempPath)
        {
            if (File.Exists(targetPath))
                File.Replace(tempPath, targetPath, destinationBackupFileName: null);
            else
                File.Move(tempPath, targetPath); // first-ever save: nothing to replace
        }

        /// <summary>Convenience for the normal (non-test) path: write then commit.</summary>
        public static void WriteAtomic(string targetPath, string content)
        {
            string tempPath = WriteTemp(targetPath, content);
            CommitReplace(targetPath, tempPath);
        }
    }
}
