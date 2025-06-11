import { CVFormat } from "src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown";

export enum EventType {
  // Frontend events
  // As a convention, all events created on the frontend should start with 20000
  CV_DOWNLOADED = 200001,
  DEMOGRAPHICS = 200002,
  USER_LOCATION = 200003,
  DEVICE_SPECIFICATION = 200004,
  NETWORK_INFORMATION = 200005,
  UI_INTERACTION = 200006,
}

interface BaseMetricsEvent {
  event_type: EventType;
}

export interface CVDownloadedEvent extends BaseMetricsEvent {
  user_id: string;
  session_id: number;
  event_type: EventType.CV_DOWNLOADED;
  cv_format: CVFormat;
  timestamp: string;
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
  browser_version: string;
  user_agent: string;
  timestamp: string;
}

export interface UserLocationEvent extends BaseMetricsEvent {
  user_id: string;
  event_type: EventType.USER_LOCATION;
  coordinates: [number, number];
  timestamp: string;
}

export interface NetworkInformationEvent extends BaseMetricsEvent {
  user_id: string;
  event_type: EventType.NETWORK_INFORMATION;
  effective_connection_type: string;
  connection_type: number;
}

export interface UIInteractionEvent extends BaseMetricsEvent {
  event_type: EventType.UI_INTERACTION;
  user_id: string;
  actions: string[];
  element_id: string; // element ids should be unique
  timestamp: string;
  relevant_experiments: Record<string, string>;
}

export type MetricsEventUnion = 
  | CVDownloadedEvent 
  | DemographicsEvent 
  | DeviceSpecificationEvent 
  | UserLocationEvent
  | NetworkInformationEvent
  | UIInteractionEvent;


export type SavableMetricsEventUnion = MetricsEventUnion & {
  client_id: string; // The client ID to associate with the event
}
