import { useState, useEffect } from 'react'
import { Switch, Route, Redirect } from 'wouter'
import { AuthProvider, useAuth } from './AuthContext'
import ProjectsList from './ProjectsList'
import NewProject from './NewProject'
import ProjectDetail from './ProjectDetail'
import NewTestCase from './NewTestCase'
import TestCaseDetail from './TestCaseDetail'
import Login from './Login'
import Register from './Register'

function ProtectedRoute({ component: Component, ...rest }) {
    const { user, loading } = useAuth();

    if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Loading auth...</div>;

    if (!user) return <Redirect to="/login" />;

    return <Component {...rest} />;
}

function AppContent() {
    return (
        <Switch>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />

            <Route path="/">
                <ProtectedRoute component={ProjectsList} />
            </Route>
            <Route path="/projects/new">
                <ProtectedRoute component={NewProject} />
            </Route>
            <Route path="/projects/:id">
                <ProtectedRoute component={ProjectDetail} />
            </Route>
            <Route path="/projects/:id/testcases/new">
                <ProtectedRoute component={NewTestCase} />
            </Route>
            <Route path="/testcases/:id">
                <ProtectedRoute component={TestCaseDetail} />
            </Route>
            <Route path="/settings">
                <ProtectedRoute component={() => <div className="p-8">Settings Page (Coming Soon)</div>} />
            </Route>

            {/* Fallback */}
            <Route><Redirect to="/" /></Route>
        </Switch>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    )
}

export default App
