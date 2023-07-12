import React, { useState } from "react";
import axios from "axios";
import PlotModal from "./PlotModal";
import OverlayUpload from "./OverlayUpload";
import { socket } from "./config/socket";
import Button from '@mui/material/Button';
import { createTheme, ThemeProvider } from "@mui/material";
import Stack from '@mui/material/Stack';
import ButtonGroup from '@mui/material/ButtonGroup';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import appConfig from '../appConfig/appConfig.json';

const appOptions = appConfig.appOptions;

const SearchBar = ({data, onFind, download, reset, updateData,
    prev, next, physicsToggle, addGraphOverlay}) => {

    const nodes = data;
    const [node, setNode] = useState("");
    const [imgUrl, setImgUrl] = useState(null);
    const [checked, setChecked] = useState(false);
    const [showPlot, setShowPlot] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    
    const theme = createTheme({
        palette: {
            primary: {
                main: '#333333'
            },
            secondary: {
                main: '#b25a00'
            }
        }
    })

    const handleChange = (e) =>
    {
        setNode(e.target.value);
    }

    const handleSubmit = (e) =>
    {
        e.preventDefault();
        
        if (nodes.get(node))
        {
            onFind(node);
        }
        else
        {
            alert(`${node} is not in the graph.`)
        }
    }

    const handleExport = (e) => {
        e.preventDefault()
        download();
    }

    const handleReset = (e) =>
    {
        e.preventDefault();
        reset();
    }

    const handlePrev = (e) => 
    {
        e.preventDefault();
        prev();
    }

    const handleNext = (e) =>
    {
        e.preventDefault();
        next();
    }

    const autoLayout = (e) =>
    {
        physicsToggle(e.target.checked);
        setChecked(e.target.checked)
    }

    const plot = async (e) => 
    {
        e.preventDefault();
        
        if(imgUrl === null)
        {
            await axios.get("http://localhost:3500/getplot", {responseType: 'blob' }).then( ( { data: blob } ) => {
                let imageUrl = URL.createObjectURL(blob);
                setImgUrl(imageUrl);
                setShowPlot(true);
            })
            .catch(( err ) => console.log( err ))
        }
        else
        {
            setShowPlot(true);
        }
    }

    const showOverlay = (e) => {

        e.preventDefault();
        setShowUpload(true)
    }

    const establishConn = async () => {
        socket.connect();

        socket.on("connect", () => {
            console.log("connected to socket server");
        })

        socket.on("message", (msg) => {
            updateData(msg);
        })

        await axios.get("http://localhost:3500/simdata").catch(( err ) => console.log( err ))
    }

    return (
        <>
        <Box sx={{m: 1, display: "flex", flexDirection: "row", justifyContent: "end"}}>
            <ThemeProvider theme={theme}>
                <Stack direction="row" spacing={1} sx={{marginRight: "auto"}}>
                    <Button 
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={handleExport}>
                        {appOptions.buttons.exportBtn}
                    </Button>

                    <Button 
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={plot}>
                        {appOptions.buttons.plotBtn}
                    </Button>

                    <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={showOverlay}>
                        {appOptions.buttons.addOverlayBtn}
                    </Button>

                    <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={establishConn}>
                        {appOptions.buttons.simBtn}
                    </Button>
                </Stack>

                <FormGroup>
                    <FormControlLabel
                        control={<Switch checked={checked} onChange={autoLayout} />}
                        label={appOptions.buttons.layoutLbl}
                        />
                </FormGroup>

                <TextField 
                    id="outlined-basic" 
                    label={appOptions.buttons.searchLbl} 
                    variant="outlined"
                    size="small"
                    onChange={handleChange}
                    sx={{width: '10rem'}}
                />

                <Stack direction="row" spacing={2}>
                    <IconButton
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={handleSubmit}
                        >
                        <SearchIcon />
                    </IconButton>

                    <ButtonGroup variant="outlined" aria-label="cycle through nodes">
                        <Button
                            size="small"
                            color="primary"
                            onClick={handlePrev}
                            >
                            {appOptions.buttons.previousBtn}
                        </Button>
                        <Button
                            size="small"
                            color="primary"
                            onClick={handleNext}
                            >
                            {appOptions.buttons.nextBtn}
                        </Button>
                    </ButtonGroup>

                    <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={handleReset}
                        >
                        {appOptions.buttons.resetBtn}
                    </Button>
                </Stack>
            </ThemeProvider>
        </Box>
        <OverlayUpload show = {showUpload} overlayFunc = {addGraphOverlay} close={() => setShowUpload(false)}/>
        <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)}/>
        </>
    );
}

export default SearchBar;