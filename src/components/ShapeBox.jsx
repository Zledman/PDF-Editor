import { useRef } from 'react';
import { rectPtToPx, rectPxToPt, pointPtToPx } from '../utils/coordMap';

export default function ShapeBox({
  shape,
  zoom,
  onUpdate,
  onDelete,
  isSelected,
  tool = null,
  onResizeStart,
  onDragStart,
  onEndpointDragStart,
  onShapeClick = null // Callback när shape klickas (för att aktivera shape-verktyget)
}) {
  const containerRef = useRef(null);

  const shapeType = shape.type || 'rectangle'; // rectangle, circle, line, arrow, highlight
  const strokeColor = shape.strokeColor || '#000000';
  const fillColor = shape.fillColor || 'transparent';
  const strokeWidth = shape.strokeWidth || 2;

  // För linjer och pilar: använd startPoint/endPoint, för andra: använd rect
  const isLineOrArrow = shapeType === 'line' || shapeType === 'arrow';
  let rectPx, startPointPx, endPointPx, boundingBox;

  if (isLineOrArrow && shape.startPoint && shape.endPoint) {
    // Punkt-till-punkt för linjer/pilar (ny format)
    startPointPx = pointPtToPx(shape.startPoint, zoom);
    endPointPx = pointPtToPx(shape.endPoint, zoom);

    // Beräkna bounding box från startPoint/endPoint
    const minX = Math.min(startPointPx.x, endPointPx.x);
    const minY = Math.min(startPointPx.y, endPointPx.y);
    const maxX = Math.max(startPointPx.x, endPointPx.x);
    const maxY = Math.max(startPointPx.y, endPointPx.y);

    boundingBox = {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1)
    };

    // Relativa koordinater inom bounding box
    const relativeStart = {
      x: startPointPx.x - minX,
      y: startPointPx.y - minY
    };
    const relativeEnd = {
      x: endPointPx.x - minX,
      y: endPointPx.y - minY
    };
    startPointPx = relativeStart;
    endPointPx = relativeEnd;
  } else if (isLineOrArrow && shape.rect) {
    // Bakåtkompatibilitet: gamla linjer/pilar med bara rect
    // Beräkna startPoint/endPoint från rect (diagonal från övre vänstra till nedre högra hörnet)
    rectPx = rectPtToPx(shape.rect, zoom);
    boundingBox = rectPx;
    startPointPx = { x: 0, y: rectPx.height };
    endPointPx = { x: rectPx.width, y: 0 };
  } else {
    // Rektangel-baserad för rektanglar, cirklar, etc.
    rectPx = rectPtToPx(shape.rect, zoom);
    boundingBox = rectPx;
  }

  // Visa ram när shape-verktyget eller highlight-verktyget är aktivt
  const showBorder = tool && (tool.startsWith('shape') || tool === 'highlight');
  const isCrossCheckTool = tool === 'shape-cross' || tool === 'shape-check';

  // Cursor: pointer när tool === null ELLER när man hovrar över en form med cross/check-verktyget,
  // move när vald och verktyget är aktivt, annars default
  let cursorStyle = 'default';
  if (tool === null || isCrossCheckTool) {
    cursorStyle = 'pointer';
  } else if (isSelected && showBorder) {
    cursorStyle = isLineOrArrow ? 'move' : 'move';
  }
  const borderStyle = isSelected && showBorder ? '2px solid #ff6600' : showBorder ? '1px dashed rgba(255, 107, 53, 0.5)' : 'none';

  // Resize handles för rektanglar/cirklar (endast när vald OCH shape-verktyget är aktivt)
  const handleSize = 8;
  const handles = isSelected && showBorder && !isLineOrArrow ? [
    { position: 'nw', style: { top: -handleSize / 2, left: -handleSize / 2, cursor: 'nw-resize' } },
    { position: 'n', style: { top: -handleSize / 2, left: '50%', marginLeft: -handleSize / 2, cursor: 'n-resize' } },
    { position: 'ne', style: { top: -handleSize / 2, right: -handleSize / 2, cursor: 'ne-resize' } },
    { position: 'e', style: { top: '50%', right: -handleSize / 2, marginTop: -handleSize / 2, cursor: 'e-resize' } },
    { position: 'se', style: { bottom: -handleSize / 2, right: -handleSize / 2, cursor: 'se-resize' } },
    { position: 's', style: { bottom: -handleSize / 2, left: '50%', marginLeft: -handleSize / 2, cursor: 's-resize' } },
    { position: 'sw', style: { bottom: -handleSize / 2, left: -handleSize / 2, cursor: 'sw-resize' } },
    { position: 'w', style: { top: '50%', left: -handleSize / 2, marginTop: -handleSize / 2, cursor: 'w-resize' } }
  ] : [];

  // Endpoint-dragpunkter för linjer/pilar (endast när vald OCH shape-verktyget är aktivt)
  const endpointHandleSize = 12; // Större för lättare interaktion
  const endpointHandles = isSelected && showBorder && isLineOrArrow && startPointPx && endPointPx ? [
    {
      type: 'start',
      style: {
        left: `${startPointPx.x - endpointHandleSize / 2}px`,
        top: `${startPointPx.y - endpointHandleSize / 2}px`,
        cursor: 'grab'
      }
    },
    {
      type: 'end',
      style: {
        left: `${endPointPx.x - endpointHandleSize / 2}px`,
        top: `${endPointPx.y - endpointHandleSize / 2}px`,
        cursor: 'grab'
      }
    }
  ] : [];

  const renderShape = () => {
    if (isLineOrArrow && startPointPx && endPointPx) {
      // Punkt-till-punkt rendering för linjer/pilar
      const width = boundingBox.width;
      const height = boundingBox.height;

      switch (shapeType) {
        case 'line':
          return (
            <line
              x1={startPointPx.x}
              y1={startPointPx.y}
              x2={endPointPx.x}
              y2={endPointPx.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          );

        case 'arrow':
          const dx = endPointPx.x - startPointPx.x;
          const dy = endPointPx.y - startPointPx.y;
          const angle = Math.atan2(dy, dx);
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          // Arrowhead size scales with strokeWidth to remain visible with thick lines
          const baseArrowHeadLength = 15;
          const arrowHeadLength = Math.max(baseArrowHeadLength, strokeWidth * 3);
          // Also scale width proportionally
          const arrowHeadAngle = Math.PI / 6; // 30 degrees
          // Calculate the base width of the arrowhead to ensure it's wider than the stroke
          const arrowHeadWidth = Math.max(arrowHeadLength * Math.sin(arrowHeadAngle), strokeWidth + 2);

          return (
            <g>
              {/* Main line - shortened slightly so it doesn't poke through the arrowhead */}
              <line
                x1={startPointPx.x}
                y1={startPointPx.y}
                x2={endPointPx.x - (arrowHeadLength * 0.5) * Math.cos(angle)}
                y2={endPointPx.y - (arrowHeadLength * 0.5) * Math.sin(angle)}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Arrow head - sized proportionally to strokeWidth */}
              <polygon
                points={`
                  ${endPointPx.x},${endPointPx.y}
                  ${endPointPx.x - arrowHeadLength * Math.cos(angle - arrowHeadAngle)},${endPointPx.y - arrowHeadLength * Math.sin(angle - arrowHeadAngle)}
                  ${endPointPx.x - arrowHeadLength * Math.cos(angle + arrowHeadAngle)},${endPointPx.y - arrowHeadLength * Math.sin(angle + arrowHeadAngle)}
                `}
                fill={strokeColor}
              />
            </g>
          );
        default:
          return null;
      }
    }

    // Rektangel-baserad rendering för rektanglar, cirklar, etc.
    const width = rectPx.width;
    const height = rectPx.height;
    const centerX = width / 2;
    const centerY = height / 2;

    switch (shapeType) {
      case 'line':
        return (
          <line
            x1={0}
            y1={height}
            x2={width}
            y2={0}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case 'arrow':
        const arrowLength = Math.sqrt(width * width + height * height);
        const angle = Math.atan2(height, width);
        // Arrowhead size scales with strokeWidth to remain visible with thick lines
        const baseArrowHeadLengthRect = 15;
        const arrowHeadLengthRect = Math.max(baseArrowHeadLengthRect, strokeWidth * 3);
        const arrowHeadAngleRect = Math.PI / 6; // 30 degrees

        return (
          <g>
            {/* Main line - shortened slightly so it doesn't poke through the arrowhead */}
            <line
              x1={0}
              y1={height}
              x2={width - (arrowHeadLengthRect * 0.5) * Math.cos(angle)}
              y2={0 + (arrowHeadLengthRect * 0.5) * Math.sin(angle)}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Arrow head - sized proportionally to strokeWidth */}
            <polygon
              points={`
                ${width},0
                ${width - arrowHeadLengthRect * Math.cos(angle - arrowHeadAngleRect)},${0 + arrowHeadLengthRect * Math.sin(angle - arrowHeadAngleRect)}
                ${width - arrowHeadLengthRect * Math.cos(angle + arrowHeadAngleRect)},${0 + arrowHeadLengthRect * Math.sin(angle + arrowHeadAngleRect)}
              `}
              fill={strokeColor}
            />
          </g>
        );

      case 'circle':
        const radius = Math.min(width, height) / 2;
        return (
          <ellipse
            cx={centerX}
            cy={centerY}
            rx={radius}
            ry={radius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            pointerEvents="stroke" // Endast ramen är klickbar, inte insidan
          />
        );

      case 'highlight':
        return (
          <rect
            width={width}
            height={height}
            fill={fillColor || 'rgba(255, 255, 0, 0.3)'}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case 'cross':
        // X-symbol (kryss)
        const crossPadding = Math.min(width, height) * 0.15;
        // Strokebredd ökar proportionellt med storleken (minst 2, max baserat på 10% av minsta dimensionen)
        const crossStrokeWidth = Math.max(2, Math.min(width, height) * 0.1);
        return (
          <g>
            <line
              x1={crossPadding}
              y1={crossPadding}
              x2={width - crossPadding}
              y2={height - crossPadding}
              stroke={strokeColor}
              strokeWidth={crossStrokeWidth}
              strokeLinecap="round"
            />
            <line
              x1={width - crossPadding}
              y1={crossPadding}
              x2={crossPadding}
              y2={height - crossPadding}
              stroke={strokeColor}
              strokeWidth={crossStrokeWidth}
              strokeLinecap="round"
            />
          </g>
        );

      case 'check':
        // Bock-symbol (check mark)
        const checkPadding = Math.min(width, height) * 0.15;
        const checkStartX = checkPadding;
        const checkMidX = width * 0.35;
        const checkEndX = width - checkPadding;
        const checkStartY = height * 0.5;
        const checkMidY = height - checkPadding;
        const checkEndY = checkPadding;
        // Strokebredd ökar proportionellt med storleken (minst 2, max baserat på 10% av minsta dimensionen)
        const checkStrokeWidth = Math.max(2, Math.min(width, height) * 0.1);
        return (
          <polyline
            points={`${checkStartX},${checkStartY} ${checkMidX},${checkMidY} ${checkEndX},${checkEndY}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={checkStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'rectangle':
      default:
        return (
          <rect
            width={width}
            height={height}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            pointerEvents="stroke" // Endast ramen är klickbar, inte insidan
          />
        );
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${boundingBox.x}px`,
        top: `${boundingBox.y}px`,
        width: `${boundingBox.width || 1}px`,
        height: `${boundingBox.height || 1}px`,
        cursor: cursorStyle,
        boxSizing: 'border-box',
        zIndex: shapeType === 'highlight' ? 1 : 2,
        // När tool === null: tillåt klick för selektion
        // När cross/check-verktyget är aktivt: tillåt klick för att välja existerande former
        // När shape-verktyget är aktivt men shape:en inte är vald, låt klick gå igenom så att man kan rita nya former
        // När shape-verktyget är aktivt och shape:en är vald, låt shapes kunna klickas för att dra/resize
        pointerEvents: (tool === null || isCrossCheckTool || (showBorder && isSelected)) ? 'auto' : 'none'
      }}
      onMouseDown={(e) => {
        // Om tool === null eller shape-verktyget inte är aktivt, fånga klicket och skicka det vidare
        // Eller om cross/check-verktyget är aktivt - tillåt selektion av existerande former
        if ((tool === null || !showBorder || isCrossCheckTool) && onShapeClick) {
          e.stopPropagation();
          onShapeClick(e);
          return;
        }
        // Om shape-verktyget är aktivt OCH shape:en är vald, låt normal hantering ske (dra/resize)
        // Men låt klick gå igenom om shape:en inte är vald, så att man kan rita nya former
        if (showBorder && isSelected && !e.target.dataset.resizeHandle && !e.target.dataset.endpointHandle && onDragStart) {
          e.stopPropagation();
          onDragStart(e);
        }
        // Om shape-verktyget är aktivt men shape:en inte är vald, låt klick gå igenom så att man kan rita nya former
      }}
    >
      <svg
        width={Math.max(boundingBox.width || 1, 1)}
        height={Math.max(boundingBox.height || 1, 1)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          // När shape-verktyget inte är aktivt, låt klick gå igenom så att man kan skapa textrutor inuti formerna
          // När shape-verktyget är aktivt och shape:en inte är vald, låt också klick gå igenom så att man kan rita nya former
          // När shape-verktyget är aktivt och shape:en är vald, låt SVG-elementet kunna klickas (men endast ramen pga pointerEvents="stroke" på rect/ellipse)
          pointerEvents: (!showBorder || (showBorder && !isSelected)) ? 'none' : (showBorder ? 'auto' : 'none')
        }}
        onMouseDown={(e) => {
          // Om shape-verktyget är aktivt OCH shape:en är vald, låt normal hantering ske (dra/resize)
          // Men låt klick gå igenom om shape:en inte är vald, så att man kan rita nya former
          if (showBorder && isSelected && !e.target.dataset.resizeHandle && !e.target.dataset.endpointHandle && onDragStart) {
            e.stopPropagation();
            onDragStart(e);
          }
          // Om shape-verktyget inte är aktivt eller shape:en inte är vald, låt klicket propageras så att ritning kan köras
        }}
      >
        {renderShape()}
      </svg>

      {/* Transparent overlay för att blockera text-cursor när shape-verktyget inte är aktivt */}
      {/* När text-verktyget är aktivt visas inte overlay:en eftersom text-cursor är önskat beteende */}
      {/* När text-verktyget inte är aktivt blockerar overlay:en text-cursor från föräldern */}
      {!showBorder && !isLineOrArrow && tool !== 'text' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'default',
            pointerEvents: 'auto',
            zIndex: 1
          }}
          onMouseDown={(e) => {
            // Om onShapeClick finns (för att aktivera shape-verktyget), anropa det
            if (onShapeClick) {
              e.stopPropagation();
              onShapeClick(e);
            }
          }}
        />
      )}

      {/* Selection border - endast för rektanglar/cirklar, inte linjer/pilar */}
      {isSelected && showBorder && !isLineOrArrow && (
        <div
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            border: borderStyle,
            pointerEvents: 'none',
            zIndex: 100
          }}
        />
      )}

      {/* Resize handles för rektanglar/cirklar */}
      {isSelected && handles.map((handle) => (
        <div
          key={handle.position}
          data-resize-handle={handle.position}
          style={{
            position: 'absolute',
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            backgroundColor: '#ff6600',
            border: '1px solid #fff',
            borderRadius: '2px',
            ...handle.style,
            zIndex: 101
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onResizeStart) {
              onResizeStart(handle.position, e);
            }
          }}
        />
      ))}

      {/* Endpoint-dragpunkter för linjer/pilar */}
      {isSelected && endpointHandles.map((handle) => (
        <div
          key={handle.type}
          data-endpoint-handle={handle.type}
          style={{
            position: 'absolute',
            width: `${endpointHandleSize}px`,
            height: `${endpointHandleSize}px`,
            backgroundColor: '#ff6600',
            border: '2px solid #fff',
            borderRadius: '50%',
            cursor: 'grab',
            ...handle.style,
            zIndex: 101,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onEndpointDragStart) {
              onEndpointDragStart(handle.type, e);
            }
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.cursor = 'grabbing';
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.cursor = 'grab';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        />
      ))}
    </div>
  );
}

