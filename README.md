# LLM Evaluation Tool

Internal single-user evaluation tool for LLM-based systems.

- **Evaluation Engine**: Stubbed scoring logic (extensible for LLM-as-a-Judge)
- **AI Integration**: Toggleable LLM Provider (Stub vs. OpenAI)

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt # or use your preferred package manager
   ```
   *Note: Requires `python-multipart`, `openai`, `pydantic-settings`*

2. **Configuration**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
## LLM Integration

The tool supports two modes: `stub` (default) and `openai`.

### Configuration
Create a `.env` file:
```env
LLM_MODE=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

### LLM Judge
When `LLM_MODE=openai`, metrics of type `LLM_JUDGE` are evaluated by the model.
- The system prompt includes the metric definition, context, and evaluation criteria.
- It produces a strict JSON output with a `score` and `explanation`.
- **Fallback**: If the OpenAI API fails, the system automatically falls back to the deterministic stub and adds a warning to the result details.

### Metric Design & Reporting
- **Design**: OpenAI proposes metrics based on User Intent.
- **Reporting**: OpenAI generates a natural language summary of test results.

## Reporting
   **Modes**:
   - `LLM_MODE=stub` (Default): Uses deterministic responses for testing/dev (No API key needed).
   - `LLM_MODE=openai`: Uses OpenAI API for real metric design and narratives. Requires `OPENAI_API_KEY`.

3. **Database**
   The application uses SQLite by default. The database file `database.db` will be created in the project root.

4. **Run the Application**:
   ```bash
   uvicorn app.main:app --reload
   ```

5. **Access Documentation**:
   - Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## API Structure

- `/api/v1/projects`: Manage projects
- `/api/v1/testcases`: Manage test cases, examples, and metric design
- `/api/v1/runs`: View evaluation runs

### Metric Design Flow

1. **Create Iteration**: `POST /api/v1/testcases/{id}/metric-design`
   - Payload: `{"user_intent": "Check for politeness"}`
   - Returns: Iteration with LLM-proposed metrics.

2. **Confirm Metrics**:   - `POST /api/v1/testcases/{id}/metric-design/{iteration_id}/confirm`: Activates the proposed metrics.
   - **Validation Rules**:
     - `LLM_JUDGE` metrics must include an `evaluation_prompt`.
     - `DETERMINISTIC` metrics must include a `rule_definition`.
     - `BOUNDED` metrics require min/max; `UNBOUNDED` must not have them.
   - Activates metrics for the test case.
   - **Note**: Once confirmed, metrics are locked for the test case.

### Evaluation Flow

1. **Preview Evaluation**: `POST /api/v1/testcases/{id}/evaluate/preview`
   - Payload: `{"outputs": ["Current model output..."]}`
   - Returns: Calculated scores (not saved), including aggregated score.
   - **Note**: Unbounded metrics (e.g., counters) are excluded from the aggregated score.

2. **Commit Evaluation**: `POST /api/v1/testcases/{id}/evaluate/commit`
   - Payload: `{"outputs": ["Current model output..."], "notes": "Version 1 candidate"}`
   - Action: Saves the run and increments the version number.
   - Returns: Run details including version and results.

### Reporting

1. **Test Case Report**: `POST /api/v1/testcases/{id}/report`
   - Payload: `{"start_date": "2023-01-01T00:00:00", "end_date": "2023-12-31T23:59:59"}`
   - Returns: Comparison between the first and last run in the range, with a narrative summary of improvements/regressions.

2. **Project Report**: `POST /api/v1/projects/{id}/report`
   - Payload: Same date range.
   - Returns: Aggregated summary of how many test cases improved, regressed, or stayed stable in the project.

## Testing

Run the automated tests:
```bash
pytest
```