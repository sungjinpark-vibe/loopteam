using System.Linq;
using NUnit.Framework;
using LifeTown.Economy.Core;
using LifeTown.Platform.Clocks;

namespace LifeTown.Platform.Tests
{
    /// <summary>
    /// AndroidMonotonicClock wraps <c>android.os.SystemClock</c> via <c>AndroidJavaClass</c>,
    /// which has no real device behind it when running in the editor - constructing it here
    /// would either throw or silently return meaningless values, neither of which is a
    /// legitimate test of device behavior. Per the task's explicit testability constraint,
    /// this class only needs to COMPILE and be structurally correct under the editor gate;
    /// all of its actually-falsifiable logic (reboot/tamper detection, §7.3.2) lives behind
    /// the IMonotonicClock seam in <see cref="LifeTown.Platform.ClockIntegrity.RebootTamperGuard"/>,
    /// which IS exercised against FakeClock in <see cref="RebootTamperGuardTests"/>.
    ///
    /// These tests therefore only check the structural contract via reflection - no
    /// instantiation, no device call.
    /// </summary>
    public class AndroidMonotonicClockStructureTests
    {
        [Test]
        public void ImplementsIMonotonicClock()
        {
            Assert.IsTrue(typeof(IMonotonicClock).IsAssignableFrom(typeof(AndroidMonotonicClock)),
                "AndroidMonotonicClock must satisfy the IMonotonicClock seam (spec §7.3.1) so it can be injected anywhere EditorMonotonicClock/FakeClock are used");
        }

        [Test]
        public void IsSealed_SingleResponsibilityClock_NotMeantToBeExtended()
        {
            Assert.IsTrue(typeof(AndroidMonotonicClock).IsSealed);
        }

        [Test]
        public void ExposesOnlyTheTwoContractProperties_NoExtraPublicSurface()
        {
            var publicProps = typeof(AndroidMonotonicClock)
                .GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
                .Select(p => p.Name)
                .OrderBy(n => n)
                .ToArray();

            CollectionAssert.AreEqual(new[] { "ElapsedMs", "WallMs" }, publicProps,
                "no extra public surface - AndroidMonotonicClock supplies time only, per §7.4's Platform scope");
        }
    }
}
