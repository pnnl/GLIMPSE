import { useEffect, useState } from "react";
import { useSigmaContext } from "../contexts/useSigmaContext";
import { Button, Space } from "antd";
import { ZoomInOutlined, ZoomOutOutlined, BorderOutlined } from "@ant-design/icons";

/**
 * Example component demonstrating how to:
 * 1. Access the raw Sigma instance from any component
 * 2. Manipulate camera/zoom outside of GraphRenderer
 * 3. Safely handle null instances
 * 4. Create reusable camera utilities
 */
export function CameraControls() {
   const { getSigma } = useSigmaContext();
   const [canZoom, setCanZoom] = useState(false);

   // Check if sigma is available when component mounts
   useEffect(() => {
      const sigma = getSigma();
      setCanZoom(sigma !== null);
   }, [getSigma]);

   const handleZoomIn = () => {
      const sigma = getSigma();
      if (!sigma) {
         console.warn("Sigma instance not available");
         return;
      }

      const camera = sigma.getCamera();
      const { x, y, ratio } = camera.getState();

      // Zoom in by reducing ratio
      camera.animate({ x, y, ratio: ratio / 1.5 }, { duration: 500, easing: "quadraticInOut" });
   };

   const handleZoomOut = () => {
      const sigma = getSigma();
      if (!sigma) {
         console.warn("Sigma instance not available");
         return;
      }

      const camera = sigma.getCamera();
      const { x, y, ratio } = camera.getState();

      // Zoom out by increasing ratio
      camera.animate({ x, y, ratio: ratio * 1.5 }, { duration: 500, easing: "quadraticInOut" });
   };

   const handleResetView = () => {
      const sigma = getSigma();
      if (!sigma) {
         console.warn("Sigma instance not available");
         return;
      }

      const camera = sigma.getCamera();

      // Reset to center with default zoom
      camera.animate({ x: 0, y: 0, ratio: 1 }, { duration: 1000, easing: "quadraticInOut" });
   };

   return (
      <Space direction="horizontal" size="small">
         <Button
            icon={<ZoomInOutlined />}
            onClick={handleZoomIn}
            disabled={!canZoom}
            title="Zoom In"
         />
         <Button
            icon={<ZoomOutOutlined />}
            onClick={handleZoomOut}
            disabled={!canZoom}
            title="Zoom Out"
         />
         <Button
            icon={<BorderOutlined />}
            onClick={handleResetView}
            disabled={!canZoom}
            title="Reset View"
         />
      </Space>
   );
}

export default CameraControls;
