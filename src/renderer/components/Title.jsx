import React from 'react';
import { Paper, Typography } from '@mui/material';

const Title = ({ titleObj }) => {
   return (
      <Paper elevation={2}>
         {Object.entries(titleObj).map(([key, value], index) => (
            <>
               <Typography key={index} variant="body2" gutterBottom>
                  <strong>{key}</strong>: {value}
               </Typography>
            </>
         ))}
      </Paper>
   );
};

export default Title;
