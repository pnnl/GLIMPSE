import React, { useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Input, Radio, Button, Divider, Empty, Spin, message, theme } from "antd";
import { v4 as uuidv4 } from "uuid";
import { MEASUREMENT_TYPE } from "./plotConstants";

// The three plottable measurement types, mirroring the legacy PlotModelCreator.
const TYPE_OPTIONS = [
    { label: "Voltage", value: MEASUREMENT_TYPE.VOLTAGE },
    { label: "Power", value: MEASUREMENT_TYPE.POWER },
    { label: "Tap", value: MEASUREMENT_TYPE.TAP },
];

const PlotCreatorModal = ({ open, close, catalog, loading = false, onCreate }) => {
    const [form] = Form.useForm();
    const { token } = theme.useToken();

    const measurementType = Form.useWatch("measurementType", form);
    const componentName = Form.useWatch("component", form);

    useEffect(() => {
        if (open) form.resetFields();
    }, [open, form]);

    // Components available for the chosen measurement type, from the live catalog.
    const componentOptions = useMemo(() => {
        if (!measurementType) return [];
        const forType = catalog?.[measurementType];
        if (!forType) return [];
        return Object.keys(forType)
            .sort((a, b) => a.localeCompare(b))
            .map((name) => ({ label: name, value: name }));
    }, [catalog, measurementType]);

    // Phases available for the chosen component (each maps to a measurement mRID).
    const phaseOptions = useMemo(() => {
        if (!measurementType || !componentName) return [];
        const entry = catalog?.[measurementType]?.[componentName];
        if (!entry) return [];
        return Object.keys(entry.phases)
            .sort((a, b) => a.localeCompare(b))
            .map((phase) => ({ label: phase === "" ? "—" : phase, value: phase }));
    }, [catalog, measurementType, componentName]);

    const isTap = measurementType === MEASUREMENT_TYPE.TAP;

    const handleCreate = async () => {
        try {
            const values = await form.validateFields();
            const entry = catalog?.[values.measurementType]?.[values.component];
            if (!entry) {
                message.error("Selected component is no longer available.");
                return;
            }

            // One series per selected phase; its id is that phase's measurement mRID.
            const components = values.phases.map((phase) => ({
                id: entry.phases[phase],
                phase,
                displayName: `${values.component}${phase === "" ? "" : ` (${phase})`}`,
            }));

            onCreate({
                id: uuidv4(),
                name: values.name,
                measurementType: values.measurementType,
                valueKind: isTap ? "value" : values.valueKind,
                components,
            });
            close();
        } catch (error) {
            if (error?.errorFields) return; // validation errors are surfaced inline
            console.error("Failed to create plot:", error);
            message.error("Failed to create plot.");
        }
    };

    if (!open) return null;

    const hasCatalog = catalog && Object.keys(catalog).length > 0;

    return ReactDOM.createPortal(
        <Modal
            centered
            open={open}
            title="Create Plot"
            onCancel={close}
            width={520}
            footer={[
                <Divider key="divider" />,
                <Button key="cancel" onClick={close}>
                    Cancel
                </Button>,
                <Button
                    key="create"
                    type="primary"
                    onClick={handleCreate}
                    disabled={!hasCatalog || loading}
                >
                    Create
                </Button>,
            ]}
        >
            <Spin spinning={loading} description="Loading measurements...">
            {!hasCatalog ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        loading
                            ? "Loading measurements…"
                            : "No device measurements available. Load a CIM model (or connect to GridAPPS-D) to build plots."
                    }
                />
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    autoComplete="off"
                    initialValues={{ valueKind: "magnitude" }}
                >
                    <Form.Item
                        label="Plot name"
                        name="name"
                        rules={[{ required: true, message: "Please enter a plot name" }]}
                    >
                        <Input placeholder="e.g. Feeder head voltage" />
                    </Form.Item>

                    <Form.Item
                        label="Measurement type"
                        name="measurementType"
                        rules={[{ required: true, message: "Please select a measurement type" }]}
                    >
                        <Select
                            placeholder="Select type"
                            options={TYPE_OPTIONS}
                            // Reset the dependent fields when the type changes.
                            onChange={() => form.setFieldsValue({ component: undefined, phases: [] })}
                            getPopupContainer={(t) => t.parentElement}
                        />
                    </Form.Item>

                    {!isTap && measurementType && (
                        <Form.Item label="Value" name="valueKind">
                            <Radio.Group>
                                <Radio value="magnitude">Magnitude</Radio>
                                <Radio value="angle">Angle</Radio>
                            </Radio.Group>
                        </Form.Item>
                    )}

                    <Form.Item
                        label="Component"
                        name="component"
                        rules={[{ required: true, message: "Please select a component" }]}
                    >
                        <Select
                            showSearch
                            placeholder={measurementType ? "Select component" : "Select a measurement type first"}
                            disabled={!measurementType}
                            options={componentOptions}
                            onChange={() => form.setFieldsValue({ phases: [] })}
                            optionFilterProp="label"
                            getPopupContainer={(t) => t.parentElement}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Phases"
                        name="phases"
                        rules={[{ required: true, message: "Please select at least one phase" }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder={componentName ? "Select phases" : "Select a component first"}
                            disabled={!componentName}
                            options={phaseOptions}
                            getPopupContainer={(t) => t.parentElement}
                        />
                    </Form.Item>

                    <p style={{ fontSize: "12px", color: token.colorTextSecondary, marginBottom: 0 }}>
                        Measurements come from the loaded CIM model.
                    </p>
                </Form>
            )}
            </Spin>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default PlotCreatorModal;
