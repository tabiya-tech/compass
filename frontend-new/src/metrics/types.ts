import { CVFormat } from "src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown";

export enum EventType {
  // Frontend events
  // As a convention, all events created on the frontend should start with 20000
  CV_DOWNLOADED = 200001,
  DEMOGRAPHICS = 200002,
  USER_LOCATION = 200003,
  DEVICE_SPECIFICATION = 200004,
  NETWORK_INFORMATION = 200005,
}

interface BaseMetricsEvent {
  event_type: EventType;
}

export interface CVDownloadedEvent extends BaseMetricsEvent {
  user_id: string;
  session_id: number;
  event_type: EventType.CV_DOWNLOADED;
  cv_format: CVFormat;
}

export interface DemographicsEvent extends BaseMetricsEvent {
  user_id: string;
  event_type: EventType.DEMOGRAPHICS;
  age: string;
  gender: string;
  education: string;
  employment_status: string;
}

export interface DeviceSpecificationEvent extends BaseMetricsEvent {
  user_id: string;
  event_type: EventType.DEVICE_SPECIFICATION;
  device_type: string;
  os_type: string;
  browser_type: string;
}

export interface UserLocationEvent extends BaseMetricsEvent {
  user_id: string;
  event_type: EventType.USER_LOCATION;
  coordinates: [number, number];
  ip_address: string;
}

export interface NetworkInformationEvent extends BaseMetricsEvent {
  user_id: string;
  event_type: EventType.NETWORK_INFORMATION;
  effective_connection_type: string;
  connection_type: number;
}

export type MetricsEventUnion = 
  | CVDownloadedEvent 
  | DemographicsEvent 
  | DeviceSpecificationEvent 
  | UserLocationEvent
  | NetworkInformationEvent;
