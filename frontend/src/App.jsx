import { useState, useEffect } from 'react'
import { Switch, Route, Redirect } from 'wouter'
import ProjectsList from './ProjectsList'
import NewProject from './NewProject'
import ProjectDetail from './ProjectDetail'
import NewTestCase from './NewTestCase'
import TestCaseDetail from './TestCaseDetail'

function App() {
    return (
        <Switch>
            <Route path="/" component={ProjectsList} />
            <Route path="/projects/new" component={NewProject} />
            <Route path="/projects/:id" component={ProjectDetail} />
            <Route path="/projects/:id/testcases/new" component={NewTestCase} />
            <Route path="/testcases/:id" component={TestCaseDetail} />
            <Route path="/settings">
                {/* Placeholder */}
                <div className="p-8 text-white">Settings Page (Coming Soon)</div>
            </Route>
            {/* Fallback */}
            <Route><Redirect to="/" /></Route>
        </Switch>
    )
}

export default App
