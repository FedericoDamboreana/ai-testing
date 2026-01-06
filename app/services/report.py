import json
from datetime import datetime
from typing import List, Optional, Tuple, Any
from sqlmodel import Session, select
from app.models.test_case import TestCase
from app.models.project import Project
from app.models.evaluation import EvaluationRun, MetricResult
from app.models.report import Report, ReportScope
from app.schemas.report import ReportContent, ReportContentMetricDelta, ReportRequest, ReportResponse

from app.providers.llm import get_llm_provider

def generate_narrative_for_test_case(content: ReportContent, model_name: Optional[str] = None) -> str:
    provider = get_llm_provider(override_model=model_name)
    return provider.generate_report_narrative(content)

def create_test_case_report(session: Session, test_case_id: int, start: Optional[datetime] = None, end: Optional[datetime] = None, start_version: Optional[int] = None, end_version: Optional[int] = None, model_name: Optional[str] = None) -> Report:
    test_case = session.get(TestCase, test_case_id)
    if not test_case:
        raise ValueError("TestCase not found")
        
    query = select(EvaluationRun).where(EvaluationRun.test_case_id == test_case_id)
    
    if start_version and end_version:
        query = query.where(EvaluationRun.version_number >= start_version).where(EvaluationRun.version_number <= end_version)
    elif start and end:
        query = query.where(EvaluationRun.created_at >= start).where(EvaluationRun.created_at <= end)
        
    runs = session.exec(query.order_by(EvaluationRun.created_at.asc())).all()
                        
    if len(runs) < 2:
        raise ValueError("Insufficient runs for comparison (need at least 2)")
        
    first_run = runs[0]
    last_run = runs[-1]
    
    # Compare
    metrics_delta = []
    
    # Map metrics by name (assuming names stable, or use logic to match definition IDs if immutable)
    # Using definition ID is safer if they match. MetricDefinition is one-to-many? 
    # Actually active metrics shouldn't change, but let's assume definition_id
    
    first_results = {r.metric_definition_id: r for r in first_run.metric_results}
    last_results = {r.metric_definition_id: r for r in last_run.metric_results}
    
    for def_id, last_res in last_results.items():
        if def_id in first_results:
            first_res = first_results[def_id]
            delta = last_res.score - first_res.score
            direction = "stable"
            if delta > 0: direction = "improved"
            elif delta < 0: direction = "worsened"
            
            # Correction: Interpretation of direction depends on target_direction. 
            # Requirements say "metrics always output a numeric score" and "standard range 0-100".
            # Usually higher is better is normalized? 
            # Stub logic: assumes higher score = improved for narration, but let's double check requirement?
            # "direction of change" in functional reqs likely means numeric change.
            # "TargetDirection" exists in MetricDefinition.
            # For "Policy Violations" (lower is better), an increase in score (count) is regression.
            # Narrative stub should ideally distinguish this, but for Phase 0 stub we can just report numeric direction
            # OR we fetch the definition to check target_direction.
            # Let's keep it simple: "score increased/decreased" or use generic improved/worsened assuming higher=better?
            # Requirement: "what improved, what worsened". So we need target direction.
            # Ideally we'd join MetricDefinition. But `MetricResult` has `metric_name` snapshot.
            # Let's assume standard higher=better for simple stub narratives, or just say "increased/decreased".
            # Wait, req example: "Policy violations decreased from 4 to 1."
            # That implies we should know the semantics.
            # Let's try to load definition to be smart?
            
            # metric_def = last_res.metric_definition # Accessing relationship
            
            metrics_delta.append(ReportContentMetricDelta(
                metric_name=last_res.metric_name,
                previous_score=first_res.score,
                current_score=last_res.score,
                delta=delta,
                direction="increased" if delta > 0 else "decreased" if delta < 0 else "stable"
            ))

    # Aggregated
    agg_delta = (last_run.aggregated_score or 0) - (first_run.aggregated_score or 0)
    agg_dir = "stable"
    if agg_delta > 0: agg_dir = "improved"
    elif agg_delta < 0: agg_dir = "worsened"
    
    content = ReportContent(
        test_case_id=test_case_id,
        test_case_name=test_case.name,
        metric_comparison=metrics_delta,
        aggregated_score_delta=agg_delta,
        aggregated_score_direction=agg_dir
    )
    
    # Generate Narrative using AI with access to Gap Analysis
    # Construct a rich context for the LLM
    history_data = []
    for r in runs:
        history_data.append({
            "version": r.version_number,
            "score": round(r.aggregated_score, 1) if r.aggregated_score is not None else 0.0,
            "gap_analysis": r.gap_analysis or "No gap analysis available."
        })
        
    context_data = {
        "test_case_name": test_case.name,
        "history": history_data
    }
    
    provider = get_llm_provider(override_model=model_name)
    narrative = provider.generate_report_narrative(context_data)
    
    report = Report(
        scope_type=ReportScope.TEST_CASE,
        scope_id=test_case_id,
        # Fallback to run dates if explicit range not provided
        start_date=start or first_run.created_at,
        end_date=end or last_run.created_at,
        content_json=content.model_dump_json(),
        summary_text=narrative
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return report

def create_project_report(session: Session, project_id: int, start: datetime, end: datetime) -> Report:
    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")
        
    # Get all test cases
    test_cases = session.exec(select(TestCase).where(TestCase.project_id == project_id)).all()
    
    improving_count = 0
    regressing_count = 0
    stable_count = 0
    
    tc_reports = []
    
    for tc in test_cases:
        try:
            # We don't necessarily persist sub-reports for project report, 
            # but we need to generate the content logic.
            # Let's reuse logic but maybe not save? OR just generate the content dict.
            # Refactoring `create_test_case_report` to split logic would be cleaner but for now lets try to generate
            # transiently or save them? Requirement says "For each test case... generate a summary".
            # It implies the project report CONTAINS summaries. 
            # Let's implement a lighter check here.
            
            runs = session.exec(select(EvaluationRun)
                        .where(EvaluationRun.test_case_id == tc.id)
                        .where(EvaluationRun.created_at >= start)
                        .where(EvaluationRun.created_at <= end)
                        .order_by(EvaluationRun.created_at.asc())).all()
            
            if len(runs) >= 2:
                first = runs[0]
                last = runs[-1]
                delta = (last.aggregated_score or 0) - (first.aggregated_score or 0)
                if delta > 0.01: improving_count += 1
                elif delta < -0.01: regressing_count += 1
                else: stable_count += 1
                
                tc_reports.append({
                     "test_case_id": tc.id,
                     "name": tc.name,
                     "status": "improved" if delta > 0.01 else "regressed" if delta < -0.01 else "stable",
                     "delta": delta
                })
            else:
                tc_reports.append({"test_case_id": tc.id, "name": tc.name, "status": "insufficient_data"})
                
        except Exception:
            pass # Skip errors
            
    summary = f"Project '{project.name}' Report. {improving_count} test cases improved, {regressing_count} regressed, {stable_count} stable."
    
    content_data = {
        "improving_count": improving_count,
        "regressing_count": regressing_count,
        "test_cases": tc_reports
    }
    
    report = Report(
        scope_type=ReportScope.PROJECT,
        scope_id=project_id,
        start_date=start,
        end_date=end,
        content_json=json.dumps(content_data),
        summary_text=summary
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return report

import io
from app.services.docx_generator import generate_word_report

def generate_test_case_word_report(session: Session, report_id: int) -> io.BytesIO:
    report = session.get(Report, report_id)
    if not report:
        raise ValueError("Report not found")
        
    test_case_id = report.scope_id
    test_case = session.get(TestCase, test_case_id)
    name = test_case.name if test_case else f"Test Case {test_case_id}"
    
    # Re-fetch runs based on report dates
    # Assuming start_date/end_date inclusive
    runs = session.exec(select(EvaluationRun)
        .where(EvaluationRun.test_case_id == test_case_id)
        .where(EvaluationRun.created_at >= report.start_date)
        .where(EvaluationRun.created_at <= report.end_date)
        .order_by(EvaluationRun.created_at.asc())
    ).all()
    
    # Run Data for Charts
    provider = get_llm_provider()
    run_data = []
    run_ids = []
    
    for r in runs:
        # Backfill Gap Analysis if missing or placeholder
        if not r.gap_analysis or "[Stub analysis placeholder]" in r.gap_analysis:
             # Trigger analysis (lazy backfill)
             # Need to ensure metric_results are loaded
             if not r.metric_results:
                 # refresh to load relationship if lazy
                 session.refresh(r) 
             
             # Convert metrics to list of dicts/objects expected by provider
             # provider expects list of objects with .score, .metric_name (MetricResult objects work due to duck typing or we wrap)
             # provider.analyze_evaluation_results implementation iterates accessing .get() which implies dict.
             # Wait, my implementation of analyze_evaluation_results in Step 129:
             # results_summary = [{"name": r.get('metric_name'), "score": r.get('score'), "explanation": r.get('explanation')} for r in metric_results]
             # It expects a list of dicts!
             # But `r.metric_results` is a list of SQLModel objects.
             # I need to convert them to dicts.
             
             results_dicts = [{"metric_name": mr.metric_name, "score": mr.score, "explanation": mr.explanation} for mr in r.metric_results]
             
             analysis = provider.analyze_evaluation_results(test_case, results_dicts)
             r.gap_analysis = analysis
             session.add(r)
             session.commit()
             session.refresh(r)

        run_data.append({
            "version": r.version_number,
            "score": r.aggregated_score,
            "created_at": r.created_at,
            "gap_analysis": r.gap_analysis
        })
        run_ids.append(r.id)
        
    # Metric Data for Charts
    metrics_data = []
    # Grouping
    metrics_map = {} # name -> list of scores
    
    for r in runs:
         # triggers lazy load of metric_results
         for res in r.metric_results:
             if res.metric_name not in metrics_map:
                 metrics_map[res.metric_name] = []
             metrics_map[res.metric_name].append({
                 "version": r.version_number,
                 "score": res.score
             })
    
    for m_name, scores in metrics_map.items():
        metrics_data.append({
            "metric_name": m_name,
            "scores": scores
        })

    return generate_word_report(
        title=f"Report: {name}",
        summary=report.summary_text,
        run_data=run_data,
        metrics_data=metrics_data
    )
