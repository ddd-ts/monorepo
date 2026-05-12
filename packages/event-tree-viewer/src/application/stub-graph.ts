import type { Graph } from "@/domain/graph";

export const stubGraph: Graph = {
  nodes: [
    {
      type: "event",
      name: "BookingRequested",
      meta: { alias: "booking.requested", base: "EsEvent" },
      source: { file: "src/booking/events.ts", start: 120 },
    },
    {
      type: "event",
      name: "BookingConfirmed",
      meta: { alias: "booking.confirmed", base: "EsEvent" },
      source: { file: "src/booking/events.ts", start: 280 },
    },
    {
      type: "event",
      name: "BookingCancelled",
      meta: { alias: "booking.cancelled", base: "EsEvent" },
      source: { file: "src/booking/events.ts", start: 440 },
    },
    {
      type: "command",
      name: "ConfirmBooking",
      meta: { base: "Command" },
      source: { file: "src/booking/commands.ts", start: 80 },
    },
    {
      type: "command",
      name: "CancelBooking",
      meta: { base: "Command" },
      source: { file: "src/booking/commands.ts", start: 200 },
    },
    {
      type: "aggregate",
      name: "Booking",
      source: { file: "src/booking/booking.aggregate.ts", start: 50 },
    },
    {
      type: "saga",
      name: "BookingSaga",
      source: { file: "src/booking/booking.saga.ts", start: 30 },
    },
    {
      type: "projection",
      name: "BookingList",
      meta: { alias: "booking-list" },
      source: { file: "src/booking/booking-list.projection.ts", start: 40 },
    },
  ],
  edges: [
    {
      from: { type: "event", name: "BookingRequested" },
      to: { type: "saga", name: "BookingSaga", method: "onRequested" },
      source: { file: "src/booking/booking.saga.ts", start: 110 },
    },
    {
      from: { type: "saga", name: "BookingSaga", method: "onRequested" },
      to: { type: "command", name: "ConfirmBooking" },
      source: { file: "src/booking/booking.saga.ts", start: 145 },
    },
    {
      from: { type: "command", name: "ConfirmBooking" },
      to: { type: "event", name: "BookingConfirmed" },
      source: { file: "src/booking/booking.handler.ts", start: 95 },
    },
    {
      from: { type: "event", name: "BookingConfirmed" },
      to: { type: "aggregate", name: "Booking", method: "confirm" },
      source: { file: "src/booking/booking.aggregate.ts", start: 170 },
    },
    {
      from: { type: "event", name: "BookingConfirmed" },
      to: { type: "projection", name: "BookingList", method: "onConfirmed" },
      source: { file: "src/booking/booking-list.projection.ts", start: 90 },
    },
    {
      from: { type: "command", name: "CancelBooking" },
      to: { type: "event", name: "BookingCancelled" },
      source: { file: "src/booking/booking.handler.ts", start: 220 },
    },
    {
      from: { type: "event", name: "BookingCancelled" },
      to: { type: "aggregate", name: "Booking", method: "cancel" },
      source: { file: "src/booking/booking.aggregate.ts", start: 300 },
    },
    {
      from: { type: "event", name: "BookingCancelled" },
      to: { type: "projection", name: "BookingList", method: "onCancelled" },
      source: { file: "src/booking/booking-list.projection.ts", start: 140 },
    },
  ],
};
