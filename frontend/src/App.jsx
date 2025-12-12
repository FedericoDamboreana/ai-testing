import { useState, useEffect } from 'react'
import { Link, Route, Switch } from 'wouter'
import ProjectDashboard from './ProjectDashboard'
import TestCaseDashboard from './TestCaseDashboard'
import './App.css'

function App() {
    return (
        <div className="container">
            <nav>
                <Link href="/">Home</Link>
            </nav>
            <main>
                <Switch>
                    <Route path="/" component={ProjectDashboard} />
                    <Route path="/project/:id" component={ProjectDashboard} />
                    <Route path="/testcase/:id" component={TestCaseDashboard} />
                    <Route>404 Not Found</Route>
                </Switch>
            </main>
        </div>
    )
}

export default App
