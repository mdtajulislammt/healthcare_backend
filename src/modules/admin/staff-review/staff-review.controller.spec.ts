import { Test, TestingModule } from '@nestjs/testing';
import { StaffReviewController } from './staff-review.controller';
import { StaffReviewService } from './staff-review.service';

describe('StaffReviewController', () => {
  let controller: StaffReviewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffReviewController],
      providers: [StaffReviewService],
    }).compile();

    controller = module.get<StaffReviewController>(StaffReviewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
