using System.IO;
using UnityEngine;

namespace LifeTown.Platform.Persistence
{
    /// <summary>
    /// Resolves where the save file lives on-device (spec §9: "on-device persistent
    /// storage"). Path composition only - no I/O, no arithmetic. Kept separate from
    /// <see cref="SaveFileRepository"/> so the repository itself stays fully testable
    /// against any path (e.g. a test's own temp directory) without depending on
    /// <see cref="Application.persistentDataPath"/>, which is only meaningful inside a
    /// running Unity player/editor.
    /// </summary>
    public static class SavePaths
    {
        private const string SaveFileName = "savefile.json";

        /// <summary><c>Application.persistentDataPath</c>/savefile.json - survives app updates, sandboxed per-app on Android.</summary>
        public static string DefaultSaveFilePath => Path.Combine(Application.persistentDataPath, SaveFileName);
    }
}
