import { getBackendUrl } from "src/envService";

const infoURL = {
  frontend: "data/version.json",
  backend: `${getBackendUrl()}/version`,
};

export default infoURL;
