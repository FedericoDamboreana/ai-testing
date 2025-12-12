from sqlmodel import Session, select
from app.core.db import engine, init_db
from app.models.project import Project
from app.models.test_case import TestCase
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.models.evaluation import EvaluationRun, MetricResult
from datetime import datetime, timedelta

def seed():
    init_db()
    with Session(engine) as session:
        # Check if project exists
        existing = session.exec(select(Project).where(Project.name == "Demo Project")).first()
        if existing:
            print("Database already seeded.")
            return

        # Create Project
        project = Project(name="Demo Project", description="A demo project for the dashboard.")
        session.add(project)
        session.commit()
        session.refresh(project)
        print(f"Created Project: {project.name} (ID: {project.id})")

        # Create Test Case
        tc = TestCase(
            name="Customer Support Bot",
            description="Bot should be polite and helpful.",
            project_id=project.id
        )
        session.add(tc)
        session.commit()
        session.refresh(tc)
        
        # Create Metrics
        m1 = MetricDefinition(
            name="Politeness",
            description="Is the bot polite?",
            test_case_id=tc.id,
            metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.BOUNDED,
            scale_min=0, scale_max=100,
            target_direction=TargetDirection.HIGHER_IS_BETTER,
            evaluation_prompt="Rate politeness 0-100."
        )
        m2 = MetricDefinition(
            name="Response Time",
            description="Latency in ms",
            test_case_id=tc.id,
            metric_type=MetricType.DETERMINISTIC,
            scale_type=ScaleType.UNBOUNDED,
            target_direction=TargetDirection.LOWER_IS_BETTER,
            rule_definition="Measure time."
        )
        session.add(m1)
        session.add(m2)
        session.commit()
        
        # Create Runs (Time Series)
        # Run 1
        r1 = EvaluationRun(
            test_case_id=tc.id, version_number=1, status="completed",
            aggregated_score=60.0, created_at=datetime.utcnow() - timedelta(days=5)
        )
        session.add(r1)
        session.commit()
        session.add(MetricResult(evaluation_run_id=r1.id, metric_definition_id=m1.id, score=60.0))
        session.add(MetricResult(evaluation_run_id=r1.id, metric_definition_id=m2.id, score=1200.0))
        
        # Run 2
        r2 = EvaluationRun(
            test_case_id=tc.id, version_number=2, status="completed",
            aggregated_score=75.0, created_at=datetime.utcnow() - timedelta(days=3)
        )
        session.add(r2)
        session.commit()
        session.add(MetricResult(evaluation_run_id=r2.id, metric_definition_id=m1.id, score=75.0))
        session.add(MetricResult(evaluation_run_id=r2.id, metric_definition_id=m2.id, score=800.0))
        
        # Run 3
        r3 = EvaluationRun(
            test_case_id=tc.id, version_number=3, status="completed",
            aggregated_score=90.0, created_at=datetime.utcnow() - timedelta(days=1)
        )
        session.add(r3)
        session.commit()
        session.add(MetricResult(evaluation_run_id=r3.id, metric_definition_id=m1.id, score=90.0))
        session.add(MetricResult(evaluation_run_id=r3.id, metric_definition_id=m2.id, score=500.0))
        
        session.commit()
        print("Seeding complete!")

if __name__ == "__main__":
    seed()
