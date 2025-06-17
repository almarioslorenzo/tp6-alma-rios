import React, { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'

const haversineDistance = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180
  const R = 6371 // km

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))

  return R * c
}

// Algoritmo de Kruskal
const buildMinimumSpanningTree = (nodes) => {
  const edges = []

  // Crear todas las posibles conexiones
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      edges.push({
        from: nodes[i],
        to: nodes[j],
        distance: haversineDistance(nodes[i], nodes[j]),
      })
    }
  }

  edges.sort((a, b) => a.distance - b.distance)

  // Unión-Find para detectar ciclos
  const parent = {}
  const find = (id) => (parent[id] !== id ? (parent[id] = find(parent[id])) : id)
  const union = (a, b) => {
    parent[find(a)] = find(b)
  }

  nodes.forEach((n) => (parent[n.id] = n.id))

  const mst = []

  for (const edge of edges) {
    const rootA = find(edge.from.id)
    const rootB = find(edge.to.id)
    if (rootA !== rootB) {
      mst.push(edge)
      union(rootA, rootB)
    }
  }

  return mst
}

const MapView = () => {
  const mapRef = useRef(null)
  const [map, setMap] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodes, setNodes] = useState([])
  const [provinceFilter, setProvinceFilter] = useState('Todas')
  const polylineRef = useRef([])

  useEffect(() => {
    const loadMap = () => {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: -34.6, lng: -58.4 },
        zoom: 6,
      })
      setMap(mapInstance)
    }

    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      script.async = true
      script.onload = loadMap
      document.body.appendChild(script)
    } else {
      loadMap()
    }
  }, [])

  useEffect(() => {
    fetch('/data.csv')
      .then((res) => res.text())
      .then((csvText) => {
        const { data } = Papa.parse(csvText, {
          delimiter: ';',
          skipEmptyLines: true,
        })

        const parsedNodes = data.map((row) => ({
          id: row[0],
          localidad: row[1],
          provincia: row[2],
          poblacion: row[3],
          estado: row[4],
          lat: parseFloat(row[5].replace(',', '.')),
          lng: parseFloat(row[6].replace(',', '.')),
        })).filter(n => !isNaN(n.lat) && !isNaN(n.lng))

        setNodes(parsedNodes)
      })
  }, [])

  useEffect(() => {
    if (!map || nodes.length === 0) return

    const filteredNodes = provinceFilter === 'Todas'
      ? nodes
      : nodes.filter(n => n.provincia === provinceFilter)

    const bounds = new window.google.maps.LatLngBounds()
    const markers = []

    polylineRef.current.forEach(p => p.setMap(null))
    polylineRef.current = []

    filteredNodes.forEach(nodo => {
      const position = { lat: nodo.lat, lng: nodo.lng }
      const marker = new window.google.maps.Marker({
        position,
        map,
        title: nodo.localidad,
      })
      marker.addListener('click', () => setSelectedNode(nodo))
      markers.push(marker)
      bounds.extend(position)
    })

    if (filteredNodes.length > 0) {
      map.fitBounds(bounds)
    }

    // Calcular conexiones cercanas
    const mstEdges = buildMinimumSpanningTree(filteredNodes)

    const newPolylines = mstEdges.map(edge => {
      const polyline = new window.google.maps.Polyline({
        path: [
          { lat: edge.from.lat, lng: edge.from.lng },
          { lat: edge.to.lat, lng: edge.to.lng },
        ],
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
      })
      polyline.setMap(map)
      return polyline
    })

    polylineRef.current = newPolylines

    return () => {
      markers.forEach(m => m.setMap(null))
      newPolylines.forEach(p => p.setMap(null))
    }
  }, [map, nodes, provinceFilter])

  const uniqueProvinces = ['Todas', ...new Set(nodes.map(n => n.provincia))]

  return (
    <div className="flex w-full h-full">
      <div className="w-3/4 h-full relative">
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute top-2 left-2 bg-white shadow px-4 py-2 rounded">
          <label className="mr-2 font-medium">Provincia:</label>
          <select
            className="border rounded p-1"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
          >
            {uniqueProvinces.map((provincia) => (
              <option key={provincia} value={provincia}>
                {provincia}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="w-1/4 h-full bg-white p-4 overflow-y-auto shadow-lg">
        {selectedNode ? (
          <>
            <h2 className="text-xl font-bold mb-2">{selectedNode.localidad}</h2>
            <p><strong>Provincia:</strong> {selectedNode.provincia}</p>
            <p><strong>Población:</strong> {selectedNode.poblacion}</p>
            <p><strong>Estado:</strong> {selectedNode.estado}</p>
            <p><strong>Lat:</strong> {selectedNode.lat}</p>
            <p><strong>Lng:</strong> {selectedNode.lng}</p>
          </>
        ) : (
          <p className="text-gray-500">Hacé clic en un nodo para ver detalles.</p>
        )}
      </div>
    </div>
  )
}

export default MapView
