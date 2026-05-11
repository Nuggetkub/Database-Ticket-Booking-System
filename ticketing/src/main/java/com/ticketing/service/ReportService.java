package com.ticketing.service;

import com.ticketing.dto.report.CapacityPoint;
import com.ticketing.dto.report.OverviewResponse;
import com.ticketing.dto.report.PeakSalesPoint;
import com.ticketing.dto.report.TopEventPoint;
import com.ticketing.dto.report.TagVenuePoint;

import java.time.LocalDate;
import java.util.List;

public interface ReportService {
    List<PeakSalesPoint> getPeakSales(LocalDate startDate, LocalDate endDate, Long eventId);
    List<TagVenuePoint>  getTagVenue(LocalDate startDate, LocalDate endDate);
    List<CapacityPoint>  getCapacity(LocalDate startDate, LocalDate endDate);
    List<TopEventPoint>   getTopEventsByIncome(LocalDate startDate, LocalDate endDate);
    List<TopEventPoint>   getTopEventsByTickets(LocalDate startDate, LocalDate endDate);
    OverviewResponse      getOverview();
}
