import type { Graph } from "@/domain/graph";

export const stubGraph: Graph = {
  nodes: [
    // ── Booking domain ─────────────────────────────────────────────
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
      type: "event",
      name: "BookingExpired",
      meta: { alias: "booking.expired", base: "EsEvent" },
      source: { file: "src/booking/events.ts", start: 600 },
    },
    {
      type: "command",
      name: "RequestBooking",
      meta: { base: "Command" },
      source: { file: "src/booking/commands.ts", start: 40 },
    },
    {
      type: "command",
      name: "ConfirmBooking",
      meta: { base: "Command" },
      source: { file: "src/booking/commands.ts", start: 160 },
    },
    {
      type: "command",
      name: "CancelBooking",
      meta: { base: "Command" },
      source: { file: "src/booking/commands.ts", start: 280 },
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
    {
      type: "projection",
      name: "BookingDetails",
      meta: { alias: "booking-details" },
      source: { file: "src/booking/booking-details.projection.ts", start: 40 },
    },

    // ── Hotel domain ───────────────────────────────────────────────
    {
      type: "event",
      name: "HotelRoomReserved",
      meta: { alias: "hotel.room.reserved", base: "EsEvent" },
      source: { file: "src/hotel/events.ts", start: 80 },
    },
    {
      type: "event",
      name: "HotelRoomReleased",
      meta: { alias: "hotel.room.released", base: "EsEvent" },
      source: { file: "src/hotel/events.ts", start: 240 },
    },
    {
      type: "command",
      name: "ReserveHotelRoom",
      meta: { base: "Command" },
      source: { file: "src/hotel/commands.ts", start: 60 },
    },
    {
      type: "command",
      name: "ReleaseHotelRoom",
      meta: { base: "Command" },
      source: { file: "src/hotel/commands.ts", start: 200 },
    },
    {
      type: "aggregate",
      name: "Hotel",
      source: { file: "src/hotel/hotel.aggregate.ts", start: 60 },
    },
    {
      type: "saga",
      name: "HotelSaga",
      source: { file: "src/hotel/hotel.saga.ts", start: 30 },
    },
    {
      type: "projection",
      name: "HotelAvailability",
      meta: { alias: "hotel-availability" },
      source: { file: "src/hotel/hotel-availability.projection.ts", start: 50 },
    },

    // ── Payment domain ─────────────────────────────────────────────
    {
      type: "event",
      name: "PaymentProcessed",
      meta: { alias: "payment.processed", base: "EsEvent" },
      source: { file: "src/payment/events.ts", start: 90 },
    },
    {
      type: "event",
      name: "PaymentFailed",
      meta: { alias: "payment.failed", base: "EsEvent" },
      source: { file: "src/payment/events.ts", start: 250 },
    },
    {
      type: "event",
      name: "PaymentRefunded",
      meta: { alias: "payment.refunded", base: "EsEvent" },
      source: { file: "src/payment/events.ts", start: 400 },
    },
    {
      type: "command",
      name: "ProcessPayment",
      meta: { base: "Command" },
      source: { file: "src/payment/commands.ts", start: 50 },
    },
    {
      type: "command",
      name: "RefundPayment",
      meta: { base: "Command" },
      source: { file: "src/payment/commands.ts", start: 190 },
    },
    {
      type: "aggregate",
      name: "Payment",
      source: { file: "src/payment/payment.aggregate.ts", start: 50 },
    },
    {
      type: "saga",
      name: "PaymentSaga",
      source: { file: "src/payment/payment.saga.ts", start: 30 },
    },
  ],

  edges: [
    // ── Booking happy path ─────────────────────────────────────────
    {
      from: { type: "command", name: "RequestBooking" },
      to: { type: "event", name: "BookingRequested" },
      source: { file: "src/booking/request-booking.handler.ts", start: 80 },
    },
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
      source: { file: "src/booking/confirm-booking.handler.ts", start: 95 },
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
      from: { type: "event", name: "BookingConfirmed" },
      to: { type: "projection", name: "BookingDetails", method: "onConfirmed" },
      source: { file: "src/booking/booking-details.projection.ts", start: 90 },
    },

    // ── Booking expiry → cancellation ──────────────────────────────
    {
      from: { type: "event", name: "BookingExpired" },
      to: { type: "saga", name: "BookingSaga", method: "onExpired" },
      source: { file: "src/booking/booking.saga.ts", start: 240 },
    },
    {
      from: { type: "saga", name: "BookingSaga", method: "onExpired" },
      to: { type: "command", name: "CancelBooking" },
      source: { file: "src/booking/booking.saga.ts", start: 275 },
    },
    {
      from: { type: "command", name: "CancelBooking" },
      to: { type: "event", name: "BookingCancelled" },
      source: { file: "src/booking/cancel-booking.handler.ts", start: 100 },
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
    {
      from: { type: "event", name: "BookingCancelled" },
      to: { type: "projection", name: "BookingDetails", method: "onCancelled" },
      source: { file: "src/booking/booking-details.projection.ts", start: 140 },
    },

    // ── Booking confirmed fans out to Hotel ────────────────────────
    {
      from: { type: "event", name: "BookingConfirmed" },
      to: { type: "saga", name: "HotelSaga", method: "onBookingConfirmed" },
      source: { file: "src/hotel/hotel.saga.ts", start: 110 },
    },
    {
      from: { type: "saga", name: "HotelSaga", method: "onBookingConfirmed" },
      to: { type: "command", name: "ReserveHotelRoom" },
      source: { file: "src/hotel/hotel.saga.ts", start: 145 },
    },
    {
      from: { type: "command", name: "ReserveHotelRoom" },
      to: { type: "event", name: "HotelRoomReserved" },
      source: { file: "src/hotel/reserve-room.handler.ts", start: 110 },
    },
    {
      from: { type: "event", name: "HotelRoomReserved" },
      to: { type: "aggregate", name: "Hotel", method: "reserveRoom" },
      source: { file: "src/hotel/hotel.aggregate.ts", start: 180 },
    },
    {
      from: { type: "event", name: "HotelRoomReserved" },
      to: { type: "projection", name: "HotelAvailability", method: "onRoomReserved" },
      source: { file: "src/hotel/hotel-availability.projection.ts", start: 100 },
    },

    // ── Booking cancelled releases the Hotel room ──────────────────
    {
      from: { type: "event", name: "BookingCancelled" },
      to: { type: "saga", name: "HotelSaga", method: "onBookingCancelled" },
      source: { file: "src/hotel/hotel.saga.ts", start: 220 },
    },
    {
      from: { type: "saga", name: "HotelSaga", method: "onBookingCancelled" },
      to: { type: "command", name: "ReleaseHotelRoom" },
      source: { file: "src/hotel/hotel.saga.ts", start: 255 },
    },
    {
      from: { type: "command", name: "ReleaseHotelRoom" },
      to: { type: "event", name: "HotelRoomReleased" },
      source: { file: "src/hotel/release-room.handler.ts", start: 110 },
    },
    {
      from: { type: "event", name: "HotelRoomReleased" },
      to: { type: "aggregate", name: "Hotel", method: "releaseRoom" },
      source: { file: "src/hotel/hotel.aggregate.ts", start: 320 },
    },
    {
      from: { type: "event", name: "HotelRoomReleased" },
      to: { type: "projection", name: "HotelAvailability", method: "onRoomReleased" },
      source: { file: "src/hotel/hotel-availability.projection.ts", start: 150 },
    },

    // ── Booking confirmed triggers Payment ─────────────────────────
    {
      from: { type: "event", name: "BookingConfirmed" },
      to: { type: "saga", name: "PaymentSaga", method: "onBookingConfirmed" },
      source: { file: "src/payment/payment.saga.ts", start: 110 },
    },
    {
      from: { type: "saga", name: "PaymentSaga", method: "onBookingConfirmed" },
      to: { type: "command", name: "ProcessPayment" },
      source: { file: "src/payment/payment.saga.ts", start: 145 },
    },
    {
      from: { type: "command", name: "ProcessPayment" },
      to: { type: "event", name: "PaymentProcessed" },
      source: { file: "src/payment/process-payment.handler.ts", start: 130 },
    },
    {
      from: { type: "command", name: "ProcessPayment" },
      to: { type: "event", name: "PaymentFailed" },
      source: { file: "src/payment/process-payment.handler.ts", start: 200 },
    },
    {
      from: { type: "event", name: "PaymentProcessed" },
      to: { type: "aggregate", name: "Payment", method: "process" },
      source: { file: "src/payment/payment.aggregate.ts", start: 160 },
    },
    {
      from: { type: "event", name: "PaymentFailed" },
      to: { type: "aggregate", name: "Payment", method: "fail" },
      source: { file: "src/payment/payment.aggregate.ts", start: 250 },
    },

    // ── Payment failed cascades back to Booking ────────────────────
    {
      from: { type: "event", name: "PaymentFailed" },
      to: { type: "saga", name: "BookingSaga", method: "onPaymentFailed" },
      source: { file: "src/booking/booking.saga.ts", start: 360 },
    },
    {
      from: { type: "saga", name: "BookingSaga", method: "onPaymentFailed" },
      to: { type: "command", name: "CancelBooking" },
      source: { file: "src/booking/booking.saga.ts", start: 395 },
    },

    // ── Booking cancelled refunds the Payment ──────────────────────
    {
      from: { type: "event", name: "BookingCancelled" },
      to: { type: "saga", name: "PaymentSaga", method: "onBookingCancelled" },
      source: { file: "src/payment/payment.saga.ts", start: 220 },
    },
    {
      from: { type: "saga", name: "PaymentSaga", method: "onBookingCancelled" },
      to: { type: "command", name: "RefundPayment" },
      source: { file: "src/payment/payment.saga.ts", start: 255 },
    },
    {
      from: { type: "command", name: "RefundPayment" },
      to: { type: "event", name: "PaymentRefunded" },
      source: { file: "src/payment/refund-payment.handler.ts", start: 110 },
    },
    {
      from: { type: "event", name: "PaymentRefunded" },
      to: { type: "aggregate", name: "Payment", method: "refund" },
      source: { file: "src/payment/payment.aggregate.ts", start: 340 },
    },
  ],
};
