import React from "react";
import { useTheme } from "@mui/material";
import { styled } from "@mui/material/styles";
import Container from "@mui/material/Container";

export type SlothProps = {
  children?: React.ReactNode;
  width?: string;
  strokeColor?: string;
  bodyColor?: string;
  faceColor?: string;
};
const uniqueId = "5f51c2ff-74cd-4a23-98b4-0c1f5404d5ee";
export const DATA_TEST_ID = {
  SLOTH: `sloth-${uniqueId}`,
};

const slothSVGSrc = (slothStyle: Readonly<SlothProps>) => `
  <g id="sloth-arm" style="fill:${slothStyle.bodyColor};fill-opacity:1">
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:3.43002;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="m 14.514759,154.02465 c -0.223222,7.54279 1.889033,14.31023 6.003671,20.12666"
      id="path11933"/>
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:3.43002;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="m 18.102994,156.94 c 0.876984,6.63374 3.47077,12.36155 7.569543,17.07907"
      id="path11935"/>
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:3.43002;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="m 22.590384,155.6948 c -0.02644,6.78986 4.860219,11.28627 8.356559,15.96141"
      id="path11937"/>
    <path
      style="display:inline;stroke:${slothStyle.strokeColor};stroke-width:4.0018;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="m 16.155526,92.631962 c -2.397382,14.608358 -5.018547,40.414198 -2.309374,58.794228 1.345636,10.71389 13.390445,3.26402 10.026414,-4.80477 -0.185829,-10.97318 3.22198,-26.38245 9.483242,-35.8906"
      id="path10943"/>
  </g>
  <g id="sloth-body" style="fill:${slothStyle.bodyColor};fill-opacity:1">
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1"
      d="M 90.43732,62.124738 C 80.765159,72.143232 61.675685,73.505359 58.059543,66.476431 56.322681,63.10038 57.085072,48.491863 55.800698,45.613442 51.842764,36.743284 42.253159,33.966119 32.313919,33.185915 30.379026,33.034031 30.27136,32.592447 26.491469,33.096325 l -2.825741,0.376686 C 9.9437551,35.302218 0.26032252,46.069416 2.2065025,59.935389 3.0716644,80.339077 10.912511,102.04229 28.700604,113.58067 c 13.577672,9.16985 30.624678,11.41364 46.669719,10.83986 18.268794,-0.877 37.706797,-9.99707 44.895357,-27.827253 5.42971,-13.34508 6.81554,-28.317784 4.94335,-42.535971 -0.6407,-6.66636 -6.04889,-6.606256 -7.19109,0.300158 -0.57049,3.449516 -4.15524,10.764389 -6.01114,3.299577      "
      id="path356"/>
  </g>
  <g id="sloth-face" style="fill:${slothStyle.faceColor};fill-opacity:1">
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:4.24961;stroke-dasharray:none;stroke-opacity:1"
      d="m 14.097135,45.06275 c 6.594093,-3.092353 13.024301,4.64989 19.788171,1.505066 5.845188,-3.519947 15.063887,-2.847274 15.553048,5.557662 1.504572,8.883565 -2.696937,20.630621 -12.677006,22.055619 -9.206273,2.426258 -21.888604,0.05935 -25.533835,-9.789371 C 9.7964043,58.277976 8.9129239,49.606375 14.097135,45.06275 Z"
      id="path1068"/>
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:4.24961;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="M 25.150328,53.598222 C 19.5057,53.230017 15.33792,56.597843 12.015927,60.78691"
      id="path1076"/>
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:4.24961;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="m 35.397394,53.690084 c 5.301525,0.26916 9.127221,3.370397 12.03295,7.622747"
      id="path1078"/>
    <path
      style="stroke:${slothStyle.strokeColor};stroke-width:4.24961;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
      d="m 23.623698,61.785599 c 4.082759,1.95693 8.532002,2.209343 12.661822,0.186749"
      id="path1260"/>
  </g>
  <path id="sloth-leg"
    style="fill:${slothStyle.bodyColor};fill-opacity:1;stroke:${slothStyle.strokeColor};stroke-width:4;stroke-linecap:round;stroke-dasharray:none;stroke-opacity:1"
    d="m 90.118843,62.518213 c 0,0 6.483175,-9.799709 7.212019,-16.207953 1.536074,-13.505678 1.472686,-33.390562 -1.085642,-36.8551862 -1.8363,-2.4867984 2.553319,-7.0642704 5.62356,-7.2690653 4.47491,-0.2984939 6.86184,7.7656371 7.13595,12.7506545 0.65157,11.849278 -0.35635,22.14692 0.7275,32.644203 0.45452,4.402105 2.77413,12.15515 2.77413,12.15515"/>
  <path id="sloth-top-arm"
    style="fill:${slothStyle.bodyColor};fill-opacity:1;stroke:${slothStyle.strokeColor};stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1"
    d="m 50.395651,79.193064 c 0,0 13.690628,-15.002471 14.631855,-34.293484 0.435414,-8.924059 2.308685,-21.46904 -0.196491,-30.411566 -0.935496,-3.339364 -8.661263,-2.000533 -8.853989,-5.4631001 -0.203842,-3.662289 5.01835,-6.392621 8.665606,-6.781779 4.579867,-0.488665 10.670019,1.635917 12.433262,6.028249 5.078151,12.6499451 4.629924,21.9263741 5.069182,33.0697121 0.395593,10.035614 6.26e-4,20.251473 -2.206773,30.0493 -1.23259,5.471008 -2.969712,11.280552 -6.082137,15.686572 -6.830033,9.66876 -9.363708,10.642509 -9.363708,10.642509"/>
  `;
export const Sloth = (props: SlothProps) => {
  const theme = useTheme();
  const slothStyle = {
    width: props.width ?? "48px",
    strokeColor: props.strokeColor ?? theme.palette.primary.main,
    bodyColor: props.bodyColor ?? theme.palette.tabiyaYellow.dark,
    faceColor: props.faceColor ?? theme.palette.tabiyaYellow.main,
  };

  const animationStyle = () => {
    return {
      margin: "0",
      padding: "0",
      overflow: "visible",
      animation: `moveBackAndForth 1200s linear infinite`,
      "@keyframes moveBackAndForth": {
        "0%": {
          transform: "translateX(0)",
        },
        "50%": {
          transform: `translateX(calc(100% - ${slothStyle.width}))`,
        },
        "100%": {
          transform: "translateX(0)",
        },
      },
      svg: {
        transformOrigin: "center", // Rotate the svg so that all the elements are rotated around the center
        animation: "bodyRotate 30s infinite linear",
        "@keyframes bodyRotate": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "25%": {
            transform: "rotate(5deg)",
          },
          "75%": {
            transform: "rotate(-5deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
        },
      },
      "#sloth-body": {
        // add any filed styles here
      },
      "#sloth-face": {
        transformOrigin: "30px 59.5px", // center of the face in viewBox coordinates
        animation: "faceRotate 20s 2s infinite linear",
        "@keyframes faceRotate": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "25%": {
            transform: "rotate(25deg)",
          },
          "75%": {
            transform: "rotate(-25deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
        },
      },
      "#sloth-arm": {
        transformOrigin: "22px 110px", // point of rotation in viewBox coordinates
        animation: "armRotate 10s infinite linear",
        "@keyframes armRotate": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "25%": {
            transform: "rotate(15deg)",
          },
          "75%": {
            transform: "rotate(-15deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
        },
      },
      "#sloth-top-arm": {
        transformOrigin: "62px 67px", // point of rotation in viewBox coordinates
        animation: "topArmRotate 20s infinite linear",
        "@keyframes topArmRotate": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "25%": {
            transform: "rotate(-10deg)",
          },
          "75%": {
            transform: "rotate(10deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
        },
      },
      "#sloth-leg": {
        transformOrigin: "92px 61px", // point of rotation in viewBox coordinates
        animation: "legRotate 20s infinite linear",
        "@keyframes legRotate": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "25%": {
            transform: "rotate(10deg)",
          },
          "75%": {
            transform: "rotate(-10deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
        },
      },
    };
  };
  // The animated container is needed to make the sloth move back and forth
  // and to hold the styles for the svg animations
  const AnimatedContainer = styled(Container)(() => animationStyle());
  return (
    <div
      data-testid={DATA_TEST_ID.SLOTH}
      style={{
        position: "relative",
        margin: "0",
        padding: "0",
      }}
    >
      {props.children}
      <AnimatedContainer>
        <svg
          overflow={"visible"}
          width={slothStyle.width}
          viewBox="0 0 128 176"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            zIndex: theme.zIndex.modal + 1,
            position: "absolute",
            bottom: `calc((6/48 - 176/128) * ${slothStyle.width})`,
            left: "0px",
          }}
          dangerouslySetInnerHTML={{ __html: slothSVGSrc(slothStyle) }}
        />
      </AnimatedContainer>
    </div>
  );
};
