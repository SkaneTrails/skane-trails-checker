import { Canvas, useThree } from '@react-three/fiber';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Coordinate } from '@/lib/types';
import { useSettings } from '@/lib/settings-context';
import { buildRibbonGeometry } from './elevation-ribbon-geometry';
import type { RibbonGeometryData } from './elevation-ribbon-geometry';
import * as THREE from 'three';

// Suppress THREE.Clock deprecation warning until @react-three/fiber migrates to THREE.Timer
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const _origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return;
    _origWarn(...args);
  };
}

interface ElevationRibbonProps {
  coordinates: Coordinate[];
  height?: number;
  width?: number;
}

/**
 * Custom shader for elevation gradient.
 * @param invertGradient - if true, dark at bottom → light at top (with dark ridgeline)
 */
function makeElevationMaterial(primaryHex: string, invertGradient: boolean) {
  const color = new THREE.Color(primaryHex);
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float elevationFactor;
      varying float vFactor;
      void main() {
        vFactor = elevationFactor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform bool uInvert;
      varying float vFactor;
      void main() {
        // light-to-dark: white at low, color at high
        // dark-to-light: color at low, white at high
        float t = uInvert ? 1.0 - vFactor : vFactor;
        vec3 col = mix(vec3(1.0), uColor, t);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    uniforms: {
      uColor: { value: color },
      uInvert: { value: invertGradient },
    },
  });
}

function RibbonMesh({ data, primaryColor, invertGradient }: { data: RibbonGeometryData; primaryColor: string; invertGradient: boolean }) {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('elevationFactor', new THREE.BufferAttribute(data.elevationFactors, 1));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeVertexNormals();
    const mat = makeElevationMaterial(primaryColor, invertGradient);
    return { geometry: geo, material: mat };
  }, [data, primaryColor, invertGradient]);

  return <mesh geometry={geometry} material={material} />;
}

/** Line along the trail — at ground (y=0) or at the ridge (top vertices) */
function TrailLine({ data, atRidge }: { data: RibbonGeometryData; atRidge: boolean }) {
  const geometry = useMemo(() => {
    const vertexCount = data.positions.length / 6; // 2 verts per point, 3 floats each
    const positions = new Float32Array(vertexCount * 3);
    // bottom verts at offset 0, top verts at offset 3 within each pair
    const offset = atRidge ? 3 : 0;
    for (let i = 0; i < vertexCount; i++) {
      positions[i * 3] = data.positions[i * 6 + offset];
      positions[i * 3 + 1] = data.positions[i * 6 + offset + 1];
      positions[i * 3 + 2] = data.positions[i * 6 + offset + 2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [data, atRidge]);

  return (
    // @ts-expect-error — R3F extends JSX with <line> element type not in standard React typings
    <line geometry={geometry}>
      <lineBasicMaterial color="#1B4332" linewidth={2} />
    </line>
  );
}


/** Reactively updates the orthographic camera when container size or data changes */
function CameraController({
  data,
  containerWidth,
  containerHeight,
}: {
  data: RibbonGeometryData;
  containerWidth: number;
  containerHeight: number;
}) {
  const { camera } = useThree();
  const maxDim = Math.max(...data.size);
  const dist = maxDim * 1.1;

  React.useEffect(() => {
    const [projW, projH] = data.projectedSize;
    const padding = 1.3;
    const zoomByHeight = projH > 0 ? containerHeight / (projH * padding) : 1;
    const zoomByWidth = projW > 0 ? containerWidth / (projW * padding) : 1;
    const zoom = Math.min(zoomByHeight, zoomByWidth) || 1;

    camera.position.set(
      data.center[0],
      data.center[1] + dist * 0.3,
      data.center[2] + dist * 0.7,
    );
    (camera as THREE.OrthographicCamera).zoom = zoom;
    camera.lookAt(data.center[0], data.center[1], data.center[2]);
    camera.updateProjectionMatrix();
  }, [camera, data, containerWidth, containerHeight, dist]);

  return null;
}

export function ElevationRibbon({ coordinates, height = 200, width }: ElevationRibbonProps) {
  const { elevationGradient } = useSettings();
  const data = useMemo(() => buildRibbonGeometry(coordinates), [coordinates]);
  const [measuredWidth, setMeasuredWidth] = React.useState(width ?? 0);

  if (!data) return null;

  const containerWidth = width ?? measuredWidth;
  const invertGradient = elevationGradient === 'dark-to-light';

  // Don't render Canvas until we have a real width measurement
  if (containerWidth === 0) {
    return (
      <View
        style={[styles.container, { height }]}
        onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      />
    );
  }

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={!width ? (e) => setMeasuredWidth(e.nativeEvent.layout.width) : undefined}
    >
      <Canvas
        orthographic
        style={{ background: 'transparent' }}
        gl={{ alpha: true }}
        camera={{ near: 0.1, far: 10000 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <CameraController data={data} containerWidth={containerWidth} containerHeight={height} />
        <RibbonMesh data={data} primaryColor="#1E7950" invertGradient={invertGradient} />
        <TrailLine data={data} atRidge={invertGradient} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
