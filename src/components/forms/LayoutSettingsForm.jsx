import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Drawer, Form, InputNumber, Switch } from "antd";
import { useGraph } from "../../contexts/GraphContext";
import { FA2_DEFAULT_SETTINGS } from "../../layout/useWorkerLayoutForceAtlas2";

const NUMBERS = [
    ["scalingRatio", "Scaling ratio", "Repulsion strength; higher spreads the graph out", 0],
    ["gravity", "Gravity", "Pull toward the center; keeps disconnected parts close", 0],
    ["slowDown", "Slow down", "Higher is steadier but slower to converge", 0.1],
    ["edgeWeightInfluence", "Edge weight influence", "0 ignores edge weights, 1 uses them as-is"],
    ["barnesHutTheta", "Barnes-Hut theta", "Approximation accuracy; only used above 2500 nodes", 0.1],
];

const SWITCHES = [
    ["linLogMode", "LinLog mode", "Tighter clusters"],
    ["outboundAttractionDistribution", "Dissuade hubs", "Pushes high-degree nodes to the borders"],
    ["strongGravityMode", "Strong gravity", "Gravity grows with distance from the center"],
    ["adjustSizes", "Prevent overlap", "Accounts for node sizes"],
];

// Edits apply live, including to a running layout
const LayoutSettingsForm = ({ open, close }) => {
    const { fa2Settings, setFa2Settings } = useGraph();
    const [form] = Form.useForm();

    useEffect(() => {
        if (open) form.setFieldsValue(fa2Settings);
    }, [open, fa2Settings, form]);

    // A cleared number field reports null; keep the last valid value
    const onValuesChange = (changed) => {
        const valid = Object.entries(changed).filter(([, v]) => v != null);
        if (valid.length) setFa2Settings((s) => ({ ...s, ...Object.fromEntries(valid) }));
    };

    return createPortal(
        // No mask, so the graph stays interactive while tuning
        <Drawer
            title="Force Layout Settings"
            placement="left"
            size={340}
            mask={false}
            forceRender
            open={open}
            onClose={close}
            footer={<Button onClick={() => setFa2Settings(FA2_DEFAULT_SETTINGS)}>Reset to Defaults</Button>}
        >
            <Form form={form} layout="vertical" size="small" onValuesChange={onValuesChange}>
                {NUMBERS.map(([name, label, tooltip, min]) => (
                    <Form.Item key={name} name={name} label={label} tooltip={tooltip}>
                        <InputNumber min={min} step={0.1} style={{ width: "100%" }} />
                    </Form.Item>
                ))}
                {SWITCHES.map(([name, label, tooltip]) => (
                    <Form.Item key={name} name={name} label={label} tooltip={tooltip} valuePropName="checked">
                        <Switch />
                    </Form.Item>
                ))}
            </Form>
        </Drawer>,
        document.getElementById("portal"),
    );
};

export default LayoutSettingsForm;
