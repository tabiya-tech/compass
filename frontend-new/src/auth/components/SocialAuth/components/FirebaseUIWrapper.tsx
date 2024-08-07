import React from "react";

const FirebaseUIWrapper = React.forwardRef<HTMLDivElement>((props, ref) => {
  return <div id="firebaseui-auth-container" ref={ref}></div>;
});

export default React.memo(FirebaseUIWrapper);
