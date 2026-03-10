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

interface TimelineEditorProps {
  blocks?: TimelineBlock[];
  isLoading?: boolean;
}

export function TimelineEditor({
  blocks: externalBlocks,
  isLoading = false,
}: TimelineEditorProps) {
  const [blocks, setBlocks] = useState<TimelineBlock[]>(() =>
    externalBlocks ?? generateTimelineBlocks()
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
  const resolvedBlocks = externalBlocks ?? blocks;

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
    <div className="space-y-3 w-full min-w-0">
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
        blocks={resolvedBlocks}
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
        blocks={resolvedBlocks}
        isLoading={isLoading}
        onBlockSelect={handleSelectBlock}
        selectedBlockIds={selectedBlockIds}
      />
    </div>
  );
}