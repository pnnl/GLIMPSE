import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
    Alert,
    Button,
    Col,
    Collapse,
    DatePicker,
    Drawer,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Switch,
    Tooltip,
    message,
    theme,
} from "antd";
import dayjs from "dayjs";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import {
    ADVANCED_CONFIG_FIELDS,
    MODEL_CREATION_CONFIG_FIELDS,
    SIMULATION_CONFIG_FIELDS,
    SIMULATOR_CONFIG_FIELDS,
    isFieldDisabled,
} from "./simulationConfigFields";

// Renders inside a themed container (the drawer body) so popups follow the
// active light/dark theme instead of the document-body default.
const popupInParent = (trigger) => trigger.parentElement;

const renderInput = (field) => {
    const disabled = isFieldDisabled(field.key);

    switch (field.input) {
        case "number":
            return (
                <InputNumber
                    stringMode
                    disabled={disabled}
                    min={field.min}
                    step={field.step}
                    style={{ width: "100%" }}
                />
            );
        case "switch":
            return <Switch disabled={disabled} />;
        case "select":
            return (
                <Select disabled={disabled} options={field.options} getPopupContainer={popupInParent} />
            );
        case "datetime":
            return (
                <DatePicker
                    showTime
                    allowClear={false}
                    disabled={disabled}
                    style={{ width: "100%" }}
                    getPopupContainer={popupInParent}
                />
            );
        case "json":
            return (
                <Input.TextArea
                    disabled={disabled}
                    autoSize={{ minRows: 2, maxRows: 8 }}
                    style={{ fontFamily: "monospace" }}
                />
            );
        default:
            return <Input disabled={disabled} />;
    }
};

const fieldRules = (field) => {
    if (field.input === "switch" || field.optional) return [];
    if (field.input === "json") {
        return [
            {
                validator: (_, value) => {
                    try {
                        JSON.parse(value);
                        return Promise.resolve();
                    } catch {
                        return Promise.reject(new Error(`${field.label} must be valid JSON`));
                    }
                },
            },
        ];
    }
    return [{ required: true, message: `${field.label} is required` }];
};

// One antd Form.Item per field definition; namePrefix locates the field's
// section inside the config object (e.g. ["simulation_config"]).
const renderFields = (fields, namePrefix) =>
    fields.map((field) => (
        <Col span={field.input === "datetime" || field.input === "json" ? 24 : 12} key={field.key}>
            <Form.Item
                label={field.label}
                name={[...namePrefix, field.key]}
                tooltip={field.tooltip}
                valuePropName={field.input === "switch" ? "checked" : "value"}
                rules={fieldRules(field)}
            >
                {renderInput(field)}
            </Form.Item>
        </Col>
    ));

// The mRIDs are stamped from the models chosen in the load modal — shown for
// reference, never editable here.
const FeederIdentifiers = ({ model, token }) => (
    <div
        style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: token.colorFillTertiary,
            borderRadius: token.borderRadiusLG,
            fontSize: 12,
            color: token.colorTextSecondary,
            wordBreak: "break-all",
        }}
    >
        <div>
            <strong>Line_name:</strong> {model.modelId}
        </div>
        <div>
            <strong>GeographicalRegion_name:</strong> {model.regionId}
        </div>
        <div>
            <strong>SubGeographicalRegion_name:</strong> {model.subRegionId}
        </div>
    </div>
);

/**
 * Left-hand drawer for editing the GridAPPS-D simulation configuration before
 * a run. The shared simulation_config is edited once; every loaded feeder gets
 * its own power_system_config section. Edits persist (per model id) via
 * socketClientHelper.applySimulationConfig until reset or app reload.
 */
const SimulationConfigForm = ({ open, onClose }) => {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const models = graphHelper.selectedGridappsdModels ?? [];

    // Flatten a full gridappsd config object into form values.
    const toFormValues = (config) => ({
        simulation_config: {
            ...config.simulation_config,
            start_time: dayjs.unix(Number(config.simulation_config.start_time) || dayjs().unix()),
        },
        power_system_configs: config.power_system_configs,
        ...Object.fromEntries(
            ADVANCED_CONFIG_FIELDS.map(({ key }) => [key, JSON.stringify(config[key], null, 2)]),
        ),
    });

    // Rebuild from the stored config each time the drawer opens, so unsaved
    // edits from a cancelled visit are discarded.
    useEffect(() => {
        if (open) {
            form.setFieldsValue(toFormValues(socketClientHelper.buildGridappsdConfig(models)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleReset = () => {
        form.setFieldsValue(toFormValues(socketClientHelper.buildDefaultGridappsdConfig(models)));
        message.info("Form reset to default values — Apply to save them.");
    };

    const handleApply = async () => {
        let values;
        try {
            values = await form.validateFields();
        } catch {
            message.error("Fix the highlighted fields before applying.");
            return;
        }

        const simulationConfig = {
            ...values.simulation_config,
            start_time: values.simulation_config.start_time.unix(),
        };

        // Defensive: a field that somehow never registered (undefined in
        // `values`) is skipped, leaving that section of the stored config
        // unchanged rather than crashing JSON.parse.
        const advancedConfig = {};
        for (const { key } of ADVANCED_CONFIG_FIELDS) {
            if (values[key] !== undefined) advancedConfig[key] = JSON.parse(values[key]);
        }

        // Merge the edited fields over each feeder's current config so
        // untouched values (e.g. simulation_output) survive.
        const powerSystemConfigsByModelId = {};
        models.forEach((model, index) => {
            const config = socketClientHelper.buildPowerSystemConfig(model);
            const edited = values.power_system_configs?.[index]?.simulator_config ?? {};
            const { model_creation_config: editedCreation = {}, ...editedSimulator } = edited;
            config.simulator_config = {
                ...config.simulator_config,
                ...editedSimulator,
                model_creation_config: {
                    ...config.simulator_config.model_creation_config,
                    ...editedCreation,
                },
            };
            powerSystemConfigsByModelId[model.modelId] = config;
        });

        socketClientHelper.applySimulationConfig({
            simulationConfig,
            advancedConfig,
            powerSystemConfigsByModelId,
        });
        message.success("Simulation configuration saved.");
        onClose();
    };

    // forceRender mounts collapsed panel content so every Form.Item registers
    // with the form up front — otherwise validateFields() omits fields of
    // panels that were never expanded.
    const feederPanels = models.map((model, index) => ({
        key: model.modelId,
        label: `Feeder: ${model.modelName ?? model.modelId}`,
        forceRender: true,
        children: (
            <>
                <FeederIdentifiers model={model} token={token} />
                <Row gutter={12}>
                    {renderFields(SIMULATOR_CONFIG_FIELDS, [
                        "power_system_configs",
                        index,
                        "simulator_config",
                    ])}
                    {renderFields(MODEL_CREATION_CONFIG_FIELDS, [
                        "power_system_configs",
                        index,
                        "simulator_config",
                        "model_creation_config",
                    ])}
                </Row>
            </>
        ),
    }));

    const advancedPanel = {
        key: "advanced",
        label: "Advanced (JSON)",
        forceRender: true,
        children: <Row gutter={12}>{renderFields(ADVANCED_CONFIG_FIELDS, [])}</Row>,
    };

    return createPortal(
        <Drawer
            title="Simulation Configuration"
            placement="left"
            size={560}
            open={open}
            onClose={onClose}
            footer={
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <Tooltip title="Fill the form with the default configuration">
                        <Button onClick={handleReset}>Reset to Defaults</Button>
                    </Tooltip>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="primary" onClick={handleApply}>
                            Apply
                        </Button>
                    </div>
                </div>
            }
        >
            {models.length === 0 && (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title="No GridAPPS-D feeders selected"
                    description="Load one or more models through “Load w/ GridAPPS-D” to configure per-feeder settings. The simulation settings below still apply."
                />
            )}
            <Form form={form} layout="vertical" autoComplete="off" size="small">
                <Row gutter={12}>{renderFields(SIMULATION_CONFIG_FIELDS, ["simulation_config"])}</Row>
                <Collapse
                    // Remount when the feeder selection changes so the first
                    // panel's default-expanded state is recomputed.
                    key={models.map((model) => model.modelId).join("|")}
                    size="small"
                    items={[...feederPanels, advancedPanel]}
                    defaultActiveKey={models[0]?.modelId}
                />
            </Form>
        </Drawer>,
        document.getElementById("portal"),
    );
};

export default SimulationConfigForm;
