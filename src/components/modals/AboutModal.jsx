import { useEffect, useState } from "react";
import { Modal } from "antd";
import ReactDom from "react-dom";
import "../../styles/About.css";

const AboutModal = ({ onMount }) => {
    const [open, setOpen] = useState(false);

    // Sending state setter to parent on mount
    useEffect(() => {
        if (onMount) {
            onMount(setOpen);
        }
    }, [onMount]);

    const close = () => setOpen(false);

    return ReactDom.createPortal(
        <Modal
            centered
            open={open}
            title={"About"}
            cancelButtonProps={{ disabled: true, style: { display: "none" } }}
            onCancel={close}
            onOk={close}
            width={750}
        >
            <div className="about-title">
                <h3>GLIMPSE v0.7.1</h3>
                <h4>(Grid Layout Interface for Model Preview and System Exploration)</h4>
            </div>
            <div className="description">
                <p>
                    GLIMPSE is a graph-based web application to visualize and update GridLAB-D power grid
                    models. The tool can be used to search and highlight power grid model objects.
                    GLIMPSE also aims to support a variety of different network representations and
                    layouts.
                </p>
            </div>
            <div className="features-list">
                <h3>User Manual</h3>
                <ul>
                    <li>
                        You can find a GLIMPSE{"'"}s User Manual{" "}
                        <a href="https://github.com/pnnl/GLIMPSE/blob/master/Docs/User_Manual.pdf">
                            here
                        </a>{" "}
                        for more information on how to use the tool.
                    </li>
                </ul>
            </div>
            <div className="citation-wrapper">
                <h3>Please Cite As</h3>
                <pre>
                    <code>
                        {`@inproceedings{sanchez2024glimpse,
   title={GLIMPSE of Future Power Grid Models},
   author={Sanchez, Armando Mendoza and Purohit, Sumit},
   booktitle={2024 IEEE 18th International Conference on Semantic Computing (ICSC)},
   pages={224--225},
   year={2024},
   organization={IEEE}
}`}
                    </code>
                </pre>
            </div>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default AboutModal;
