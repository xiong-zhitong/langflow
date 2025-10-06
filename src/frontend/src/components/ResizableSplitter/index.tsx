import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/utils";

interface ResizableSplitterProps {
  children: [React.ReactNode, React.ReactNode];
  defaultSplit?: number; // 默认分割比例 (0-1)
  minSize?: number; // 最小高度 (px)
  maxSize?: number; // 最大高度 (px)
  className?: string;
  onResize?: (topHeight: number, bottomHeight: number) => void;
}

const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  children,
  defaultSplit = 0.7, // 默认上部分占70%
  minSize = 200,
  maxSize,
  className = "",
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [splitRatio, setSplitRatio] = useState(defaultSplit);
  const [containerHeight, setContainerHeight] = useState(0);

  // 更新容器高度
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // 处理鼠标按下事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // 处理鼠标移动事件
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY - containerRect.top;
      const newRatio = mouseY / containerRect.height;

      // 计算实际高度
      const topHeight = newRatio * containerRect.height;
      const bottomHeight = (1 - newRatio) * containerRect.height;

      // 应用最小/最大高度限制
      const effectiveMaxSize = maxSize || containerRect.height - minSize;

      if (
        topHeight >= minSize &&
        topHeight <= effectiveMaxSize &&
        bottomHeight >= minSize
      ) {
        setSplitRatio(newRatio);
        onResize?.(topHeight, bottomHeight);
      }
    },
    [isDragging, minSize, maxSize, onResize],
  );

  // 处理鼠标释放事件
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);

    // 在拖拽结束后延迟触发回调，确保DOM更新完成
    setTimeout(() => {
      if (containerRef.current && onResize) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const topHeight = splitRatio * containerRect.height;
        const bottomHeight = (1 - splitRatio) * containerRect.height;
        onResize(topHeight, bottomHeight);
      }
    }, 50);
  }, [splitRatio, onResize]);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const topHeight = `${splitRatio * 100}%`;
  const bottomHeight = `${(1 - splitRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col h-full w-full", className)}
    >
      {/* 上半部分 */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{ height: topHeight }}
      >
        {children[0]}
      </div>

      {/* 分隔条 */}
      <div
        className={cn(
          "flex-shrink-0 h-1 bg-border hover:bg-blue-500 transition-colors cursor-ns-resize relative group",
          isDragging && "bg-blue-500",
        )}
        onMouseDown={handleMouseDown}
      >
        {/* 拖拽指示器 */}
        <div className="absolute inset-x-0 -top-1 -bottom-1 flex items-center justify-center">
          <div
            className={cn(
              "w-12 h-1 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
              isDragging && "opacity-100 bg-blue-500",
            )}
          />
        </div>

        {/* 扩展点击区域 */}
        <div className="absolute inset-x-0 -top-2 -bottom-2" />
      </div>

      {/* 下半部分 */}
      <div className="flex-1 overflow-hidden" style={{ height: bottomHeight }}>
        {children[1]}
      </div>
    </div>
  );
};

export default ResizableSplitter;
