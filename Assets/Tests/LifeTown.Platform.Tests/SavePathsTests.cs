using NUnit.Framework;
using UnityEngine;
using LifeTown.Platform.Persistence;

namespace LifeTown.Platform.Tests
{
    public class SavePathsTests
    {
        [Test]
        public void DefaultSaveFilePath_IsUnderPersistentDataPath_AndNamedSavefileJson()
        {
            string path = SavePaths.DefaultSaveFilePath;

            StringAssert.StartsWith(Application.persistentDataPath, path);
            StringAssert.EndsWith("savefile.json", path);
        }
    }
}
