package com.ticketing.controller;

import com.ticketing.dto.report.CapacityPoint;
import com.ticketing.dto.report.OverviewResponse;
import com.ticketing.dto.report.PeakSalesPoint;
import com.ticketing.dto.report.TopEventPoint;
import com.ticketing.dto.report.TagVenuePoint;
import com.ticketing.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/peak-sales")
    public ResponseEntity<List<PeakSalesPoint>> peakSales(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long eventId) {
        return ResponseEntity.ok(reportService.getPeakSales(startDate, endDate, eventId));
    }

    @GetMapping("/tag-venue")
    public ResponseEntity<List<TagVenuePoint>> tagVenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getTagVenue(startDate, endDate));
    }

    @GetMapping("/capacity")
    public ResponseEntity<List<CapacityPoint>> capacity(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getCapacity(startDate, endDate));
    }

    @GetMapping("/top-events-income")
    public ResponseEntity<List<TopEventPoint>> topEventsByIncome(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getTopEventsByIncome(startDate, endDate));
    }

    @GetMapping("/top-events-tickets")
    public ResponseEntity<List<TopEventPoint>> topEventsByTickets(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getTopEventsByTickets(startDate, endDate));
    }

    @GetMapping("/overview")
    public ResponseEntity<OverviewResponse> overview() {
        return ResponseEntity.ok(reportService.getOverview());
    }
}
