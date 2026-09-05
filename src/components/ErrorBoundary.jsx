import React from "react";
import { Button, Result, Typography } from "antd";

/**
 * Last line of defence for a render that throws.
 *
 * Without this, one bad node in a model payload — or any other throw during
 * render — unmounts the whole tree and leaves a blank page with no way back.
 * The graph lives in a module singleton rather than React state, so remounting
 * the tree is not enough to recover; a reload is the honest offer.
 */
class ErrorBoundary extends React.Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("Unhandled error in render:", error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <Result
                status="error"
                title="GLIMPSE hit an unexpected error"
                subTitle="The view could not be rendered. Reloading starts fresh — any unsaved model edits will be lost."
                style={{ padding: "48px 24px" }}
                extra={[
                    <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                        Reload GLIMPSE
                    </Button>,
                ]}
            >
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    <Typography.Text code style={{ whiteSpace: "pre-wrap" }}>
                        {this.state.error?.message || String(this.state.error)}
                    </Typography.Text>
                </Typography.Paragraph>
            </Result>
        );
    }
}

export default ErrorBoundary;
