using System;
using System.IO;
using System.Text;
using LifeTown.Economy.Core.Models;
using Newtonsoft.Json;

namespace LifeTown.Platform.Persistence
{
    /// <summary>
    /// On-device JSON persistence for <see cref="SaveFile"/> (spec §9, §11.2 week 3-4).
    /// Pure byte-shuffling: this class supplies bytes to/from disk and nothing else - no
    /// economy arithmetic runs here (§7.4). Uses Newtonsoft (spec §7.5) rather than
    /// <c>JsonUtility</c> because <c>SaveFile</c>'s graph contains
    /// <c>Dictionary&lt;string,int&gt;</c> (<see cref="DailyStat.perCategoryCreditedSeconds"/>)
    /// and jagged arrays, neither of which <c>JsonUtility</c> can serialize.
    ///
    /// Writes go through <see cref="AtomicFileWriter"/>: a crash mid-write can never
    /// corrupt the last good save on disk.
    /// </summary>
    public sealed class SaveFileRepository
    {
        private readonly string _filePath;

        public SaveFileRepository(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                throw new ArgumentException("filePath is required", nameof(filePath));
            _filePath = filePath;
        }

        /// <summary>Absolute path this repository reads/writes. Exposed for diagnostics/tests.</summary>
        public string FilePath => _filePath;

        /// <summary>
        /// Returns <c>null</c> when no save file exists yet (first launch on a fresh
        /// device) - callers are responsible for constructing a fresh <see cref="SaveFile"/>
        /// in that case. Never returns a half-written result: only
        /// <see cref="AtomicFileWriter.CommitReplace"/>'d content is ever visible at
        /// <see cref="FilePath"/>.
        /// </summary>
        public SaveFile Load()
        {
            if (!File.Exists(_filePath)) return null;
            string json = File.ReadAllText(_filePath, Encoding.UTF8);
            return JsonConvert.DeserializeObject<SaveFile>(json);
        }

        /// <summary>Serializes and atomically replaces the on-disk file (see <see cref="AtomicFileWriter"/>).</summary>
        public void Save(SaveFile saveFile)
        {
            if (saveFile == null) throw new ArgumentNullException(nameof(saveFile));
            string json = JsonConvert.SerializeObject(saveFile, Formatting.Indented);
            AtomicFileWriter.WriteAtomic(_filePath, json);
        }
    }
}
