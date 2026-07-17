using System;
using UnityEngine;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// One required parry tap within a C1_Basic pattern step (GDD §7.2's "요구 입력"
    /// column, e.g. Lampang P1 = "패링 ×2"). <see cref="beatOffsetSeconds"/> and
    /// <see cref="telegraphLeadSeconds"/> are NOT given exact values anywhere in the GDD
    /// (§7.2 names the rhythm qualitatively — "정박 2연" for P1 — without seconds), so
    /// the defaults here are PROVISIONAL staging values, not judgment numbers: they only
    /// decide when the beat lands and how long its telegraph runs, never whether a tap
    /// counts as perfect/good/miss (that's exclusively GameplayConfig's job). Flagged as
    /// team-discretion staging detail per GDD §0, reported as provisional regardless.
    /// </summary>
    [Serializable]
    public class ParryBeat
    {
        [Tooltip("Seconds from pattern-step start to this beat's judgment target time. " +
                 "PROVISIONAL - GDD §7.2 says '정박 2연' but gives no exact seconds.")]
        public float beatOffsetSeconds = 0.6f;

        [Tooltip("Seconds the outer ring visibly contracts before this beat. Cosmetic " +
                 "pacing only - does not affect judgment. PROVISIONAL default.")]
        public float telegraphLeadSeconds = 1.0f;
    }
}
