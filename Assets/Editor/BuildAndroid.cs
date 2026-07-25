using UnityEditor;
using UnityEngine;

public static class BuildAndroid
{
    // Invoked via: Unity.exe -batchmode -quit -projectPath <path> -executeMethod BuildAndroid.Build -logFile <log>
    public static void Build()
    {
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.looptteam.lifetown");
        PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;

        var options = new BuildPlayerOptions
        {
            scenes = new[] { "Assets/LifeTown.App/Scenes/SpikeVillageV2.unity" },
            locationPathName = "Builds/Android/lifetown.apk",
            target = BuildTarget.Android,
            options = BuildOptions.None
        };

        var report = BuildPipeline.BuildPlayer(options);
        var summary = report.summary;

        Debug.Log($"BUILD_RESULT result={summary.result} totalErrors={summary.totalErrors} totalWarnings={summary.totalWarnings} outputPath={summary.outputPath} sizeBytes={summary.totalSize}");

        if (summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
        {
            EditorApplication.Exit(1);
        }
    }
}
