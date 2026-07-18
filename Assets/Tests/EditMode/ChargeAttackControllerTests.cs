using NUnit.Framework;
using UnityEngine;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests
{
    /// <summary>
    /// IN-5 (GDD §4.1): press-and-hold-and-release. Below the configured threshold a
    /// release falls back to an ordinary IN-1 basic attack (reusing MonsterPart's own
    /// event); at or above it, the charged-attack event fires instead. Exactly one of
    /// the two fires per release - never both, never neither.
    /// </summary>
    public class ChargeAttackControllerTests
    {
        private static ChargeAttackController CreateController(float minHold = 0.35f, float fullCharge = 1.2f)
        {
            var go = new GameObject("ChargeAttackUnderTest");
            var controller = go.AddComponent<ChargeAttackController>();
            var so = new UnityEditor.SerializedObject(controller);
            so.FindProperty("minHoldSecondsForCharge").floatValue = minHold;
            so.FindProperty("fullChargeSeconds").floatValue = fullCharge;
            so.ApplyModifiedPropertiesWithoutUndo();
            return controller;
        }

        [Test]
        public void OnHoldStarted_SetsIsCharging()
        {
            var controller = CreateController();
            Assert.IsFalse(controller.IsCharging);
            controller.OnHoldStarted();
            Assert.IsTrue(controller.IsCharging);
            Object.DestroyImmediate(controller.gameObject);
        }

        [Test]
        public void ReleaseBelowThreshold_RaisesBasicAttack_NotChargedAttack()
        {
            var controller = CreateController(minHold: 0.35f);
            MonsterPart basicAttackSender = null;
            bool chargedFired = false;
            controller.OnBasicAttack += p => basicAttackSender = p;
            controller.OnChargedAttackReleased += () => chargedFired = true;

            controller.OnHoldStarted();
            controller.OnHoldReleased(0.10f); // well under the threshold

            Assert.AreSame(controller, basicAttackSender, "A short hold must fall back to an ordinary IN-1 basic attack.");
            Assert.IsFalse(chargedFired, "A short hold must NOT fire the charged-attack event.");
            Assert.IsFalse(controller.IsCharging, "Releasing must end the charging state.");
            Object.DestroyImmediate(controller.gameObject);
        }

        [Test]
        public void ReleaseAtOrAboveThreshold_RaisesChargedAttack_NotBasicAttack()
        {
            var controller = CreateController(minHold: 0.35f);
            MonsterPart basicAttackSender = null;
            bool chargedFired = false;
            controller.OnBasicAttack += p => basicAttackSender = p;
            controller.OnChargedAttackReleased += () => chargedFired = true;

            controller.OnHoldStarted();
            controller.OnHoldReleased(0.50f); // above the threshold

            Assert.IsTrue(chargedFired, "A hold at/above the threshold must fire the charged-attack event.");
            Assert.IsNull(basicAttackSender, "A charged release must NOT also fire the ordinary basic-attack event.");
            Object.DestroyImmediate(controller.gameObject);
        }

        [Test]
        public void ExactlyAtThreshold_CountsAsCharged()
        {
            var controller = CreateController(minHold: 0.35f);
            bool chargedFired = false;
            controller.OnChargedAttackReleased += () => chargedFired = true;

            controller.OnHoldStarted();
            controller.OnHoldReleased(0.35f);

            Assert.IsTrue(chargedFired);
            Object.DestroyImmediate(controller.gameObject);
        }
    }
}
