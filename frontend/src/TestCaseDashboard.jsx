import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchWithAuth } from './AuthContext'

export default function TestCaseDashboard({ params }) {
    const id = params.id
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchWithAuth(`/api/v1/testcases/${id}/dashboard`)
            .then(res => res.json())
            .then(data => {
                setData(data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [id])

    if (loading) return <div>Loading...</div>
    if (!data) return <div>Error loading test case</div>

    return (
        <div className="dashboard">
            <h1>{data.test_case_name} (ID: {data.test_case_id})</h1>

            <div className="chart-section">
                <h2>Aggregated Score Evolution</h2>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <LineChart data={data.aggregated_score_points}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="version_number" label={{ value: 'Version', position: 'insideBottom', offset: -5 }} />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="score" stroke="#8884d8" activeDot={{ r: 8 }} name="Aggregated Score" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="metrics-grid">
                {data.metrics.map(metric => (
                    <div key={metric.metric_definition_id} className="chart-card">
                        <h3>{metric.metric_name}</h3>
                        <p className="subtitle">{metric.scale_type} | {metric.target_direction}</p>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer>
                                <LineChart data={metric.points}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="version_number" />
                                    <YAxis domain={metric.scale_type === 'BOUNDED' ? [0, 100] : ['auto', 'auto']} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="score" stroke="#82ca9d" name="Score" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
