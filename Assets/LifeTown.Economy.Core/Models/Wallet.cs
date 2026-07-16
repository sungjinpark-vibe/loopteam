namespace LifeTown.Economy.Core.Models
{
    /// <summary>Derived projection - rebuildable from the SessionRecord log (spec §9).</summary>
    public class Wallet
    {
        public long coin;
        public long totalExpEarned; // lifetime, display only
    }
}
