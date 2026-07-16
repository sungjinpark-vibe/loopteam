using System.Collections.Generic;

namespace LifeTown.Economy.Core.Models
{
    public class TownState
    {
        public int gridWidth = 8;
        public int gridHeight = 8;
        public List<BuildingInstance> buildings = new List<BuildingInstance>();
        public string[] occupiedCells = new string[64]; // len 64, buildingId or null. index = y*8+x
        public int version;                              // local optimistic-concurrency seed for future sync
    }
}
