import { Test, TestingModule } from '@nestjs/testing';
import { StaffReviewService } from './staff-review.service';

describe('StaffReviewService', () => {
  let service: StaffReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffReviewService],
    }).compile();

    service = module.get<StaffReviewService>(StaffReviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
