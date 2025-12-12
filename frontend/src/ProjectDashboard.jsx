import { useState, useEffect } from 'react'
import { Link, useRoute } from 'wouter'

export default function ProjectDashboard({ params }) {
    // Default to project 1 for simplicity if not provided, or handle routing
    const projectId = params?.id || 1
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`http://localhost:8000/api/v1/projects/${projectId}/dashboard`)
            .then(res => res.json())
            .then(data => {
                setData(data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [projectId])

    if (loading) return <div>Loading...</div>
    if (!data) return <div>Error loading project or Project Not Found (Ensure ID {projectId} exists)</div>

    return (
        <div className="dashboard">
            <h1>{data.project_name} Dashboard</h1>

            <div className="summary-cards">
                <div className="card">
                    <h3>Total Test Cases</h3>
                    <p className="big-number">{data.summary.total_test_cases}</p>
                </div>
                <div className="card">
                    <h3>With Runs</h3>
                    <p className="big-number">{data.summary.test_cases_with_runs}</p>
                </div>
                <div className="card">
                    <h3>Avg Score</h3>
                    <p className="big-number">
                        {data.summary.avg_latest_aggregated_score
                            ? data.summary.avg_latest_aggregated_score.toFixed(1)
                            : "-"}
                    </p>
                </div>
            </div>

            <h2>Test Cases</h2>
            <div className="tc-list">
                {data.test_cases.map(tc => (
                    <div key={tc.test_case_id} className="tc-row">
                        <div className="tc-info">
                            <Link href={`/testcase/${tc.test_case_id}`}>
                                <strong>{tc.test_case_name}</strong>
                            </Link>
                        </div>
                        <div className="tc-score">
                            {tc.latest_run ? (
                                <ScoreBadge score={tc.latest_run.aggregated_score} />
                            ) : (
                                <span className="no-data">No runs</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ScoreBadge({ score }) {
    if (score === null || score === undefined) return <span>-</span>
    let color = 'red'
    if (score >= 75) color = 'green'
    else if (score >= 50) color = 'yellow'

    return (
        <span className={`badge ${color}`}>
            {score.toFixed(1)}
        </span>
    )
}
