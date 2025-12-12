from typing import List, Dict
from sqlmodel import Session, select
from app.models.project import Project
from app.models.test_case import TestCase
from app.models.evaluation import EvaluationRun, MetricResult
from app.models.metric import MetricDefinition
from app.schemas.dashboard import (
    TestCaseDashboardResponse, MetricSeries, MetricPoint,
    ProjectDashboardResponse, ProjectSummary, TestCaseSummary, RunSummary, MetricScore
)

def get_test_case_dashboard(session: Session, test_case_id: int) -> TestCaseDashboardResponse:
    test_case = session.get(TestCase, test_case_id)
    if not test_case:
        return None
        
    # Fetch all runs with results
    # Ideally use a join, but for simplicity/safety with current models:
    runs = session.exec(
        select(EvaluationRun)
        .where(EvaluationRun.test_case_id == test_case_id)
        .where(EvaluationRun.status == "completed")
        .order_by(EvaluationRun.version_number)
    ).all()
    
    # Organize data
    # metric_id -> Series
    metrics_map: Dict[int, MetricSeries] = {}
    points_agg: List[MetricPoint] = []
    
    for run in runs:
        # Aggregated score point
        if run.aggregated_score is not None:
            points_agg.append(MetricPoint(
                version_number=run.version_number,
                created_at=run.created_at,
                score=run.aggregated_score
            ))
            
        # Metric points
        # Fetch results for this run
        results = session.exec(
            select(MetricResult).where(MetricResult.evaluation_run_id == run.id)
        ).all()
        
        for res in results:
            m_def = session.get(MetricDefinition, res.metric_definition_id)
            if not m_def or not m_def.is_active:
                continue
                
            if m_def.id not in metrics_map:
                metrics_map[m_def.id] = MetricSeries(
                    metric_definition_id=m_def.id,
                    metric_name=m_def.name,
                    scale_type=m_def.scale_type,
                    target_direction=m_def.target_direction,
                    points=[]
                )
            
            metrics_map[m_def.id].points.append(MetricPoint(
                version_number=run.version_number,
                created_at=run.created_at,
                score=res.score
            ))
            
    return TestCaseDashboardResponse(
        test_case_id=test_case.id,
        test_case_name=test_case.name,
        metrics=list(metrics_map.values()),
        aggregated_score_points=points_agg
    )

def get_project_dashboard(session: Session, project_id: int) -> ProjectDashboardResponse:
    project = session.get(Project, project_id)
    if not project:
        return None
        
    test_cases = session.exec(select(TestCase).where(TestCase.project_id == project_id)).all()
    
    tc_summaries = []
    total_agg_score = 0
    count_with_runs = 0
    
    for tc in test_cases:
        # Get latest run
        latest_run = session.exec(
            select(EvaluationRun)
            .where(EvaluationRun.test_case_id == tc.id)
            .where(EvaluationRun.status == "completed")
            .order_by(EvaluationRun.version_number.desc())
        ).first()
        
        tc_summary = TestCaseSummary(
            test_case_id=tc.id,
            test_case_name=tc.name
        )
        
        if latest_run:
            tc_summary.latest_run = RunSummary(
                version_number=latest_run.version_number,
                created_at=latest_run.created_at,
                aggregated_score=latest_run.aggregated_score
            )
            
            if latest_run.aggregated_score is not None:
                total_agg_score += latest_run.aggregated_score
                count_with_runs += 1
            
            # Fetch scores
            results = session.exec(
                select(MetricResult).where(MetricResult.evaluation_run_id == latest_run.id)
            ).all()
            
            for res in results:
                # We need metric name
                m_def = session.get(MetricDefinition, res.metric_definition_id)
                if m_def:
                    tc_summary.latest_metrics.append(MetricScore(
                        metric_definition_id=m_def.id,
                        metric_name=m_def.name,
                        score=res.score
                    ))
        
        tc_summaries.append(tc_summary)
        
    avg_score = (total_agg_score / count_with_runs) if count_with_runs > 0 else None
    
    return ProjectDashboardResponse(
        project_id=project.id,
        project_name=project.name,
        summary=ProjectSummary(
            total_test_cases=len(test_cases),
            test_cases_with_runs=count_with_runs,
            avg_latest_aggregated_score=avg_score
        ),
        test_cases=tc_summaries
    )
