import React from 'react';
import { SpeedDial, SpeedDialAction, Stack, Tooltip } from '@mui/material';
import { Adjust, RotateRightSharp, RotateLeftSharp } from '@mui/icons-material';
import { CustomFab } from '../utils/CustomComponents';

const VisActionsDial = ({ rotateCW, rotateCCW, prev, next }) => {
  return (
    <Stack
      alignItems={'center'}
      direction={'row'}
      spacing={1}
      sx={{ position: 'absolute', top: '4.4rem', right: 10 }}
    >
      <SpeedDial
        direction="left"
        ariaLabel="action-speed-dial"
        icon={<Adjust />}
        sx={{
          ['& .MuiSpeedDial-fab']: {
            backgroundColor: '#333',
            width: '3rem',
            height: '3rem',
            ':hover': { backgroundColor: '#45AB48' }
          }
        }}
      >
        <SpeedDialAction
          key={'rotatecw'}
          title={'Rotate CW'}
          icon={<RotateRightSharp />}
          placement="bottom"
          onClick={rotateCW}
        />
        <SpeedDialAction
          key={'rotateccw'}
          icon={<RotateLeftSharp />}
          title={'Rotate CCW'}
          placement="bottom"
          onClick={rotateCCW}
        />
      </SpeedDial>
      <CustomFab variant="extended" onClick={prev}>
        Prev
      </CustomFab>
      <CustomFab variant="extended" onClick={next}>
        Next
      </CustomFab>
    </Stack>
  );
};

export default VisActionsDial;
