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
    REALTIME_INTERVAL,
    SIMULATION_CONFIG_FIELDS,
    SIMULATOR_CONFIG_FIELDS,
    TIMING_FIELD_KEYS,
    VALIDATED_TIMING_FIELDS,
    isFieldDisabled,
} from "./simulationConfigFields";

// Renders inside a themed container (the drawer body) so popups follow the
// active light/dark theme instead of the document-body default.
const popupInParent = (trigger) => trigger.parentElement;

// `context` carries the live form state a field needs to decide whether it is
// locked (currently just { runRealtime }).
const renderInput = (field, context) => {
    const disabled = isFieldDisabled(field.key) || Boolean(field.disabledWhen?.(context));

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
    return [{ required: true, message: `${field.label} is required` }, ...(field.rules ?? [])];
};

// One antd Form.Item per field definition; namePrefix locates the field's
// section inside the config object (e.g. ["simulation_config"]).
const renderFields = (fields, namePrefix, context = {}) =>
    fields.map((field) => (
        <Col span={field.input === "datetime" || field.input === "json" ? 24 : 12} key={field.key}>
            <Form.Item
                label={field.label}
                name={[...namePrefix, field.key]}
                tooltip={field.tooltip}
                valuePropName={field.input === "switch" ? "checked" : "value"}
                rules={fieldRules(field)}
                // Custom rules assume a usable value, so stop at the first
                // failure instead of stacking "required" on top of them.
                validateFirst={Boolean(field.rules)}
            >
                {renderInput(field, context)}
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
    // Drives the interval field's locked state; the switch is elsewhere in the
    // form, so a watch is needed to re-render on toggle.
    const runRealtime = Form.useWatch(["simulation_config", "run_realtime"], form);

    // Flatten a full gridappsd config object into form values.
    const toFormValues = (config) => ({
        simulation_config: {
            ...config.simulation_config,
            start_time: dayjs.unix(Number(config.simulation_config.start_time) || dayjs().unix()),
            // A stored config could predate the real-time rule; the interval
            // field is locked, so it has to open with a value the user could
            // not otherwise correct.
            interval: config.simulation_config.run_realtime
                ? REALTIME_INTERVAL
                : config.simulation_config.interval,
        },
        power_system_configs: config.power_system_configs,
        ...Object.fromEntries(
            ADVANCED_CONFIG_FIELDS.map(({ key }) => [key, JSON.stringify(config[key], null, 2)]),
        ),
    });

    // duration/publish_period/interval/run_realtime validate against each other,
    // and antd's `dependencies` only cascades to fields the user has already
    // touched — so revalidate the whole timing group on any change to it.
    const handleValuesChange = (changedValues) => {
        const changedTiming = changedValues.simulation_config;
        if (!changedTiming || !TIMING_FIELD_KEYS.some((key) => key in changedTiming)) return;

        if (changedTiming.run_realtime === true) {
            form.setFieldValue(["simulation_config", "interval"], REALTIME_INTERVAL);
        }
        form.validateFields(
            VALIDATED_TIMING_FIELDS.map((key) => ["simulation_config", key]),
        ).catch(() => {
            // Rejects with the field errors it just rendered; nothing to do.
        });
    };

    // Rebuild from the stored config each time the drawer opens, so unsaved
    // edits from a cancelled visit are discarded. The reset drops their
    // validation errors too — every value is re-set on the next line.
    useEffect(() => {
        if (open) {
            form.resetFields();
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
            <Form
                form={form}
                layout="vertical"
                autoComplete="off"
                size="small"
                onValuesChange={handleValuesChange}
            >
                <Row gutter={12}>
                    {renderFields(SIMULATION_CONFIG_FIELDS, ["simulation_config"], { runRealtime })}
                </Row>
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
