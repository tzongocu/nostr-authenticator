import { createPortal } from 'react-dom';
import { ReactNode } from 'react';

interface PortalProps {
  children: ReactNode;
}

const Portal = ({ children }: PortalProps) => {
  return createPortal(children, document.body);
};

export default Portal;
