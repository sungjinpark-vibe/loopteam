namespace TouchRPG.Combat.Input
{
    /// <summary>
    /// GDD §4.1 IN-5: "길게 누르고 떼기" (press-and-hold-and-release) - the one input
    /// vocabulary entry that is not a discrete tap. An <see cref="ITappable"/> winner
    /// that also implements this interface is routed by <see cref="CombatInputController"/>
    /// into the hold lifecycle (OnHoldStarted -&gt; ... -&gt; OnHoldReleased) instead of the
    /// normal instant <see cref="ITappable.OnTapped"/> call. This is still "one gesture"
    /// per P-2 (GDD §2) - IN-5 is explicitly named in the GDD's own input vocabulary, not
    /// a new gesture invented by this task.
    /// </summary>
    public interface IHoldable
    {
        /// <summary>Called the instant the press begins (finger/mouse down) on this target.</summary>
        void OnHoldStarted();

        /// <summary>Called on release. <paramref name="heldSeconds"/> is the real elapsed
        /// hold duration, so the implementer decides for itself whether that counts as a
        /// full charge, a partial charge, or too short to count as a hold at all.</summary>
        void OnHoldReleased(float heldSeconds);
    }
}
