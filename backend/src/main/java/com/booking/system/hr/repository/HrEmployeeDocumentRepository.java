package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeDocument;
import com.booking.system.hr.enums.HrDocumentCategory;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface HrEmployeeDocumentRepository extends HrRepository<HrEmployeeDocument, String> {

    @Query("select doc from HrEmployeeDocument doc where doc.employee.id = :employeeId order by doc.createdAt desc")
    List<HrEmployeeDocument> findAllByEmployeeId(@Param("employeeId") String employeeId);

    @Query("select doc from HrEmployeeDocument doc where doc.employee.id = :employeeId and doc.documentCategory = :category order by doc.createdAt desc")
    List<HrEmployeeDocument> findAllByEmployeeIdAndCategory(
            @Param("employeeId") String employeeId,
            @Param("category") HrDocumentCategory category
    );

    @EntityGraph(attributePaths = "employee")
    @Query("select doc from HrEmployeeDocument doc where doc.id = :id")
    Optional<HrEmployeeDocument> findDetailById(@Param("id") String id);

    long countByEmployee_Id(String employeeId);

    void delete(HrEmployeeDocument entity);
}
