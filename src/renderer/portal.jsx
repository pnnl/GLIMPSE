import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Watch from './components/Watch';

const componentMap = {
  Watch: Watch
  // Add other components here as needed
};

const Portal = () => {
  const [component, setComponent] = useState(null);
  const [props, setProps] = useState({});

  useEffect(() => {
    const removeListener = window.glimpseAPI.onRenderComponent((data) => {
      setComponent(data.component);
      setProps(data.props);
    });

    return () => {
      removeListener();
    };
  }, []);

  if (!component || !componentMap[component]) {
    return null;
  }

  const Component = componentMap[component];
  return <Component {...props} />;
};

const protal = createRoot(document.getElementById('portal'));
protal.render(<Portal />);
