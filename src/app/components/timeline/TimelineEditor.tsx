import { useState, useMemo, useCallback } from "react";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTracks } from "./TimelineTracks";
import { AppUsageList } from "./AppUsageList";
import {
  type TimelineBlock,
  generateTimelineBlocks,
  generateNetworkData,
  generateAPMData,
  generateMarkers,
  generateActivityStatus,
} from "./timeline-data";

export function TimelineEditor() {
  const [blocks, setBlocks] = useState<TimelineBlock[]>(() =>
    generateTimelineBlocks()
  );
  const [zoom, setZoom] = useState(1.5);
  const [visibleTracks, setVisibleTracks] = useState({
    status: true,
    windows: true,
    network: true,
    apm: true,
  });
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(
    new Set()
  );

  const networkData = useMemo(() => generateNetworkData(), []);
  const apmData = useMemo(() => generateAPMData(), []);
  const markers = useMemo(() => generateMarkers(), []);
  const activityStatus = useMemo(() => generateActivityStatus(), []);

  const handleSelectBlock = useCallback(
    (block: TimelineBlock) => {
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(block.id)) {
          next.delete(block.id);
        } else {
          next.add(block.id);
        }
        return next;
      });
    },
    []
  );

  const handleToggleTrack = (track: string) => {
    setVisibleTracks((prev) => ({ ...prev, [track]: !prev[track] }));
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <TimelineToolbar
        zoom={zoom}
        visibleTracks={visibleTracks}
        onToggleTrack={handleToggleTrack}
        selectedCount={selectedBlockIds.size}
        onClearSelection={() => setSelectedBlockIds(new Set())}
      />

      {/* Multi-Track Timeline */}
      <TimelineTracks
        blocks={blocks}
        networkData={networkData}
        apmData={apmData}
        markers={markers}
        activityStatus={activityStatus}
        zoom={zoom}
        onZoomChange={setZoom}
        visibleTracks={visibleTracks}
        onSelectBlock={handleSelectBlock}
        selectedBlockIds={selectedBlockIds}
      />

      {/* App Usage Detail List */}
      <AppUsageList
        blocks={blocks}
        onBlockSelect={handleSelectBlock}
        selectedBlockIds={selectedBlockIds}
      />
    </div>
  );
}